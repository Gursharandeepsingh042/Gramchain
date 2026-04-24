"""
Credit scoring route — uses XGBoost model (or rule-based fallback for demo)
"""
from fastapi import APIRouter, HTTPException
import os
import joblib
import numpy as np
from pathlib import Path

from api.schemas import ScoreRequest, ScoreResponse

router = APIRouter()

# Load model if available, else use rule-based fallback
MODEL_PATH = Path(__file__).parent.parent / "model" / "credit_model.joblib"

_model = None

def get_model():
    global _model
    if _model is None and MODEL_PATH.exists():
        try:
            _model = joblib.load(MODEL_PATH)
            print("✅ ML model loaded from disk")
        except Exception as e:
            print(f"⚠️  Could not load model: {e}")
    return _model


def rule_based_score(features: dict) -> float:
    """
    Fallback rule-based credit scoring (no ML model needed).
    Returns probability of default (lower = better).
    """
    score = 0.0

    # Meeting attendance (30% weight)
    score += (1 - features["meeting_attendance_rate"]) * 0.30

    # Group repayment history (30% weight)
    score += (1 - features["group_repayment_history"]) * 0.30

    # Individual repayment history (20% weight)
    score += (1 - features["individual_prior_repayment"]) * 0.20

    # Savings regularity (10% weight)
    score += (1 - features["savings_regularity"]) * 0.10

    # Savings to loan ratio bonus (10% weight)
    ratio_bonus = min(features["savings_to_loan_ratio"] / 5.0, 1.0)
    score += (1 - ratio_bonus) * 0.10

    return max(0.0, min(1.0, score))


def prob_to_credit_score(prob_default: float) -> int:
    """Convert default probability to credit score (300-900 scale)"""
    return round(300 + (1 - prob_default) * 600)


def get_risk_band(score: int) -> tuple[str, bool]:
    if score >= 700:
        return "LOW", True
    elif score >= 550:
        return "MEDIUM", True
    else:
        return "HIGH", False


@router.post("/", response_model=ScoreResponse)
async def get_credit_score(request: ScoreRequest):
    """
    Compute credit score for a borrower.
    Uses XGBoost model if trained, else rule-based fallback.
    """
    features_dict = request.features.model_dump()
    feature_array = np.array([[
        features_dict["meeting_attendance_rate"],
        features_dict["savings_regularity"],
        features_dict["group_repayment_history"],
        features_dict["loan_count"],
        features_dict["individual_prior_repayment"],
        features_dict["savings_to_loan_ratio"],
        features_dict["tenure_months"],
        features_dict["seasonal_factor"],
    ]])

    model = get_model()

    if model is not None:
        prob_default = float(model.predict_proba(feature_array)[0][1])
    else:
        prob_default = rule_based_score(features_dict)

    credit_score = prob_to_credit_score(prob_default)
    risk_band, approval_recommended = get_risk_band(credit_score)

    # Feature importance breakdown (for UI transparency)
    breakdown = {
        "meeting_attendance": round(features_dict["meeting_attendance_rate"] * 100),
        "repayment_history": round(features_dict["individual_prior_repayment"] * 100),
        "group_health": round(features_dict["group_repayment_history"] * 100),
        "savings_score": round(features_dict["savings_regularity"] * 100),
    }

    return ScoreResponse(
        score=credit_score,
        risk_band=risk_band,
        approval_recommended=approval_recommended,
        probability_of_default=round(prob_default, 4),
        breakdown=breakdown,
    )
