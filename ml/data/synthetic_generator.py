"""
Synthetic SHG credit data generator
Generates realistic training data based on NABARD SHG patterns
"""
import numpy as np
import pandas as pd
from pathlib import Path


def generate_dataset(n_samples: int = 2000, random_state: int = 42) -> pd.DataFrame:
    """Generate synthetic SHG member credit dataset"""
    rng = np.random.default_rng(random_state)

    # Features
    meeting_attendance = rng.beta(5, 1.5, n_samples).clip(0.2, 1.0)
    savings_regularity = rng.beta(4, 2, n_samples).clip(0.1, 1.0)
    group_repayment = rng.beta(6, 1.2, n_samples).clip(0.3, 1.0)
    loan_count = rng.integers(0, 8, n_samples)
    individual_repayment = rng.beta(5.5, 1.5, n_samples).clip(0.2, 1.0)
    savings_ratio = rng.lognormal(0.5, 0.8, n_samples).clip(0.1, 10.0)
    tenure_months = rng.integers(3, 84, n_samples)
    seasonal_factor = rng.choice([0.7, 0.85, 1.0, 0.9], n_samples, p=[0.15, 0.25, 0.35, 0.25])

    # Default probability (weighted combination)
    default_prob = (
        (1 - meeting_attendance) * 0.30
        + (1 - group_repayment) * 0.30
        + (1 - individual_repayment) * 0.20
        + (1 - savings_regularity) * 0.10
        + (1 - np.minimum(savings_ratio / 5.0, 1.0)) * 0.10
    )
    default_prob = default_prob * 0.8 + rng.uniform(0, 0.1, n_samples)
    defaulted = (rng.uniform(0, 1, n_samples) < default_prob).astype(int)

    df = pd.DataFrame({
        "meeting_attendance_rate": meeting_attendance,
        "savings_regularity": savings_regularity,
        "group_repayment_history": group_repayment,
        "loan_count": loan_count,
        "individual_prior_repayment": individual_repayment,
        "savings_to_loan_ratio": savings_ratio,
        "tenure_months": tenure_months,
        "seasonal_factor": seasonal_factor,
        "defaulted": defaulted,
    })

    print(f"✅ Generated {n_samples} samples. Default rate: {defaulted.mean():.1%}")

    # Save to CSV
    out_path = Path(__file__).parent / "sample_data.csv"
    df.to_csv(out_path, index=False)
    print(f"💾 Saved: {out_path}")

    return df


if __name__ == "__main__":
    generate_dataset(2000)
