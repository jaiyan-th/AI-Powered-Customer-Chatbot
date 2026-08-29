# server.py
"""
FastAPI Server for GlassSupport:
- Customer AI Chatbot & Privacy Router
- Customer Request Dashboard (Pending vs Completed)
- Authentication Key Verification for Direct Live Chat
- Higher Officials Portal & 2-Way Direct Message Synchronization
- Customer Reviews & CSAT Analytics
"""

import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from db import init_db
from backend import (
    chat_with_bot,
    get_customer_requests,
    verify_customer_auth_key,
    get_request_chat_thread,
    send_customer_message_in_request,
    send_official_reply_in_request,
    complete_customer_request,
    get_all_official_requests,
    submit_customer_review,
    get_all_reviews,
    get_dashboard_metrics
)

init_db()

app = FastAPI(
    title="CSP (Customer Support Provider) — Customer Support Platform",
    description="Customer Request & Higher Official Authentication Hub",
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Request Payloads
# -----------------------------------------------------------------------------
class ChatRequest(BaseModel):
    query: str
    email: Optional[str] = "customer@example.com"
    category: Optional[str] = None

class VerifyOTPPayload(BaseModel):
    email: str
    otp: str

class VerifyAuthKeyPayload(BaseModel):
    request_id: str
    auth_key: str
    user_email: str

class SendMessagePayload(BaseModel):
    request_id: str
    user_email: str
    message: str

class OfficialReplyPayload(BaseModel):
    request_id: str
    message: str
    official_name: Optional[str] = "Dr. Sarah Jenkins"

class CompleteRequestPayload(BaseModel):
    request_id: str
    resolution_notes: Optional[str] = ""

class ReviewPayload(BaseModel):
    user_name: Optional[str] = "Customer"
    user_email: str
    rating: int
    issue_faced: str
    is_resolved: str
    service_feedback: Optional[str] = ""
    unresolved_details: Optional[str] = ""

# -----------------------------------------------------------------------------
# REST Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    result = chat_with_bot(payload.query, payload.email or "customer@example.com", payload.category)
    return result

@app.post("/api/verify-otp")
async def verify_otp_endpoint(payload: VerifyOTPPayload):
    if payload.otp.strip() in ["123456", "998877", "445566"]:
        return {
            "success": True,
            "message": "OTP Verified Successfully. Secure records decrypted.",
            "data": {
                "account_holder": payload.email,
                "ledger_status": "Active & Verified",
                "available_balance": "$14,850.00 USD",
                "last_transaction": "ACH Credit #99281 - Settled",
                "card_status": "Active / Unfrozen"
            }
        }
    raise HTTPException(status_code=400, detail="Invalid OTP code entered. Please try again.")

# Customer Requests Endpoints (Pending & Completed)
@app.get("/api/customer/requests/{user_email:path}")
async def customer_requests_endpoint(user_email: str):
    data = get_customer_requests(user_email)
    return data

@app.post("/api/customer/verify-auth-key")
async def verify_auth_key_endpoint(payload: VerifyAuthKeyPayload):
    res = verify_customer_auth_key(payload.request_id, payload.auth_key, payload.user_email)
    if not res.get("success"):
        raise HTTPException(status_code=401, detail=res.get("message"))
    return res

@app.get("/api/request-thread/{request_id}")
async def request_thread_endpoint(request_id: str):
    messages = get_request_chat_thread(request_id)
    return {"request_id": request_id, "messages": messages}

@app.post("/api/customer/send-message")
async def customer_send_message_endpoint(payload: SendMessagePayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    res = send_customer_message_in_request(payload.request_id, payload.user_email, payload.message)
    return res

class OfficialLoginPayload(BaseModel):
    email: str
    passcode: Optional[str] = ""

# Higher Official Portal Endpoints
@app.post("/api/official/login")
async def official_login_endpoint(payload: OfficialLoginPayload):
    from backend import authenticate_higher_official
    res = authenticate_higher_official(payload.email, payload.passcode or "")
    if not res.get("success"):
        raise HTTPException(status_code=401, detail=res.get("message"))
    return res

@app.get("/api/official/requests")
async def official_requests_endpoint(official_email: Optional[str] = None):
    data = get_all_official_requests(official_email)
    return data

@app.post("/api/official/reply")
async def official_reply_endpoint(payload: OfficialReplyPayload):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    res = send_official_reply_in_request(payload.request_id, payload.message, payload.official_name or "Dr. Sarah Jenkins")
    return res

@app.post("/api/requests/complete")
async def complete_request_endpoint(payload: CompleteRequestPayload):
    res = complete_customer_request(payload.request_id, payload.resolution_notes or "")
    return res

# Reviews & Stats
@app.post("/api/reviews")
async def submit_review_endpoint(payload: ReviewPayload):
    res = submit_customer_review(
        user_name=payload.user_name or "Customer",
        user_email=payload.user_email,
        rating=payload.rating,
        issue_faced=payload.issue_faced,
        is_resolved=payload.is_resolved,
        service_feedback=payload.service_feedback or "",
        unresolved_details=payload.unresolved_details or ""
    )
    return res

@app.get("/api/reviews")
async def get_reviews_endpoint():
    reviews = get_all_reviews()
    return {"reviews": reviews}

@app.get("/api/stats")
async def stats_endpoint():
    return get_dashboard_metrics()

# Mount Static UI Files
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
