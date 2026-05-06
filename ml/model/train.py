"""
GramChain ML Training Pipeline
Trains XGBoost credit scoring model on synthetic SHG data
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import xgboost as xgb
import joblib
from pathlib import Path

FEATURE_COLS = [
    "meeting_attendance_rate",
    "savings_regularity",
    "group_repayment_history",
    "loan_count",
    "individual_prior_repayment",
    "savings_to_loan_ratio",
    "tenure_months",
    "seasonal_factor",
]

def train_model(data_path: str = None):
    """Train XGBoost model on SHG credit data"""
    
    # Load or generate data
    if data_path and Path(data_path).exists():
        df = pd.read_csv(data_path)
    else:
        print("📊 Generating synthetic training data...")
        from data.synthetic_generator import generate_dataset
        df = generate_dataset(n_samples=2000)
    
    X = df[FEATURE_COLS]
    y = df["defaulted"]
    
    print(f"📈 Dataset: {len(df)} samples, {y.mean():.1%} default rate")
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("xgb", xgb.XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            scale_pos_weight=(y_train == 0).sum() / (y_train == 1).sum(),
            use_label_encoder=False,
            eval_metric="auc",
            random_state=42,
        )),
    ])
    
    model.fit(X_train, y_train, xgb__verbose=False)
    
    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    
    print(f"\n✅ Model trained!")
    print(f"   AUC-ROC: {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["No Default", "Default"]))
    
    # Save model
    output_path = Path(__file__).parent / "credit_model.joblib"
    joblib.dump(model, output_path)
    print(f"💾 Saved: {output_path}")
    
    return model, auc


if __name__ == "__main__":
    train_model()
