"""
Credit scoring schemas using Pydantic v2
"""
from pydantic import BaseModel, Field
from typing import Optional


class CreditFeatures(BaseModel):
    """Input features for credit scoring model"""
    meeting_attendance_rate: float = Field(
        ..., ge=0.0, le=1.0, description="% of SHG meetings attended (last 12 months)"
    )
    savings_regularity: float = Field(
        ..., ge=0.0, le=1.0, description="Coefficient of variation of monthly savings"
    )
    group_repayment_history: float = Field(
        ..., ge=0.0, le=1.0, description="Group-level on-time repayment rate"
    )
    loan_count: int = Field(..., ge=0, description="Number of prior loans")
    individual_prior_repayment: float = Field(
        ..., ge=0.0, le=1.0, description="Individual on-time repayment % of past loans"
    )
    savings_to_loan_ratio: float = Field(
        ..., ge=0.0, description="Group savings / requested loan amount"
    )
    tenure_months: int = Field(..., ge=0, description="Months as SHG member")
    seasonal_factor: float = Field(
        ..., ge=0.0, le=1.0, description="Agricultural calendar factor"
    )


class ScoreRequest(BaseModel):
    """Full credit score request"""
    member_id: str
    shg_id: str
    loan_amount: float = Field(..., gt=0, description="Requested loan amount in USD")
    features: CreditFeatures


class ScoreResponse(BaseModel):
    """Credit score API response"""
    score: int = Field(..., description="Credit score on 300-900 scale")
    risk_band: str = Field(..., description="LOW / MEDIUM / HIGH")
    approval_recommended: bool
    probability_of_default: float = Field(..., ge=0.0, le=1.0)
    breakdown: dict = Field(default_factory=dict, description="Feature importance breakdown")
    model_version: str = "1.0.0"
