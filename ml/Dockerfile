FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train the credit scoring model at build time so it is baked into the image.
# The rule-based fallback in score.py handles requests if this fails.
RUN python -m model.train || echo "⚠️  Model training failed — rule-based fallback will be used"

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
