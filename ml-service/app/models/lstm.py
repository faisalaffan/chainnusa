"""LSTM transaction sequence anomaly detector (PyTorch)."""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
import joblib
import logging

log = logging.getLogger(__name__)


class TxSeqAutoencoder(nn.Module):
    def __init__(self, input_dim: int = 3, hidden_dim: int = 64, num_layers: int = 2):
        super().__init__()
        self.encoder = nn.LSTM(
            input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.2,
        )
        self.decoder_lstm = nn.LSTM(
            hidden_dim, hidden_dim, num_layers, batch_first=True, dropout=0.2,
        )
        self.output_layer = nn.Linear(hidden_dim, input_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (h_n, _) = self.encoder(x)
        latent = h_n[-1].unsqueeze(1).repeat(1, x.size(1), 1)
        out, _ = self.decoder_lstm(latent)
        return self.output_layer(out)


class LstmAnomalyDetector:
    def __init__(
        self, seq_len: int = 64, input_dim: int = 3, hidden_dim: int = 64,
        num_layers: int = 2, random_state: int = 42,
    ):
        self.seq_len = seq_len
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.random_state = random_state
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = TxSeqAutoencoder(input_dim, hidden_dim, num_layers).to(self.device)
        self.scaler = StandardScaler()
        self._threshold: float = 0.0

    def _prepare_sequences(
        self, value_series: list[list[float]], gas_series: list[list[float]],
        time_delta_series: list[list[float]],
    ) -> torch.Tensor:
        N = len(value_series)
        data = np.zeros((N, self.seq_len, 3), dtype=np.float32)
        for i in range(N):
            v = value_series[i] if i < len(value_series) else []
            g = gas_series[i] if i < len(gas_series) else []
            t = time_delta_series[i] if i < len(time_delta_series) else []
            L = min(len(v), len(g), len(t), self.seq_len)
            if L == 0:
                continue
            data[i, -L:, 0] = v[-L:]
            data[i, -L:, 1] = g[-L:]
            data[i, -L:, 2] = t[-L:]
        return data

    def train(
        self, value_series: list[list[float]], gas_series: list[list[float]],
        time_delta_series: list[list[float]], epochs: int = 50, batch_size: int = 32,
        lr: float = 1e-3,
    ) -> dict:
        data = self._prepare_sequences(value_series, gas_series, time_delta_series)
        orig_shape = data.shape
        flat = data.reshape(-1, 3)
        flat_scaled = self.scaler.fit_transform(flat)
        data = flat_scaled.reshape(orig_shape)

        dataset = TensorDataset(torch.from_numpy(data))
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        criterion = nn.MSELoss()

        self.model.train()
        losses = []
        for epoch in range(epochs):
            epoch_loss = 0.0
            for (batch,) in loader:
                batch = batch.to(self.device)
                optimizer.zero_grad()
                recon = self.model(batch)
                loss = criterion(recon, batch)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item() * batch.size(0)
            avg_loss = epoch_loss / len(dataset)
            losses.append(avg_loss)
            if (epoch + 1) % 10 == 0:
                log.info(f"LSTM epoch {epoch+1}/{epochs} loss={avg_loss:.6f}")

        # compute threshold from reconstruction errors
        self.model.eval()
        with torch.no_grad():
            all_data = torch.from_numpy(data).to(self.device)
            recon = self.model(all_data)
            errors = ((recon - all_data) ** 2).mean(dim=(1, 2)).cpu().numpy()
        self._threshold = float(np.percentile(errors, 95))

        return {
            "final_loss": losses[-1],
            "threshold_95": self._threshold,
            "epochs": epochs,
            "device": str(self.device),
        }

    def predict(self, value_series: list[list[float]], gas_series: list[list[float]],
                time_delta_series: list[list[float]]) -> tuple[list[bool], np.ndarray]:
        data = self._prepare_sequences(value_series, gas_series, time_delta_series)
        orig_shape = data.shape
        flat = data.reshape(-1, 3)
        flat_scaled = self.scaler.transform(flat)
        data = flat_scaled.reshape(orig_shape)

        self.model.eval()
        with torch.no_grad():
            tensor = torch.from_numpy(data).to(self.device)
            recon = self.model(tensor)
            errors = ((recon - tensor) ** 2).mean(dim=(1, 2)).cpu().numpy()
        is_anomaly = errors >= self._threshold
        return list(is_anomaly), errors

    def save(self, path: str) -> None:
        torch.save(self.model.state_dict(), path + ".pt")
        joblib.dump({
            "scaler": self.scaler, "threshold": self._threshold,
            "seq_len": self.seq_len, "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim, "num_layers": self.num_layers,
        }, path + ".meta")

    def load(self, path: str) -> None:
        self.model.load_state_dict(torch.load(path + ".pt", map_location=self.device))
        meta = joblib.load(path + ".meta")
        self.scaler = meta["scaler"]
        self._threshold = meta["threshold"]
        self.model.to(self.device)
        self.model.eval()
