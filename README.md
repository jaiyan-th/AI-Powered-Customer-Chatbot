# CSP (Customer Support Provider) — Customer Support Platform

An enterprise-grade **Customer Support Platform (CSP)** built with FastAPI, SQLite FTS5 (BM25) full-text ranking, and a sleek Glassmorphic interface. It bridges automated AI customer resolution with executive-level governance, role-based Higher Officials authentication, and email authentication keys.

---

## 🌟 Key Features

### 1. 🤖 Intelligent Customer Support Chat
* **Hybrid Semantic & BM25 Search**: Matches customer inquiries against an active knowledge base using SQLite Full-Text Search (FTS5) with BM25 relevance ranking.
* **Confidence Scoring**: Returns verified, structured step-by-step solutions with confidence rating badges (e.g. `HIGH MATCH 98%`).
* **Interactive 2FA / Sensitive Verification**: Automated one-time passcode verification before revealing confidential account or banking records.
* **Speech Recognition & Text-to-Speech (TTS)**: Built-in voice input and natural speech playback.

### 2. 🔒 Privacy, Confidentiality & Higher Officials Escalation
* **Strict Confidentiality Safeguards**: Detects legal, privacy, executive, or unresolvable technical inquiries.
* **Executive Routing**: Automatically routes the request to designated Higher Officials (*Chief Governance Officer, Banking Director, Head of Enterprise Security*).
* **Authentication Key Dispatch**: Generates a secure `REQ-XXXX` (Request ID) and an `AUTH-XXXX` (Authentication Key) sent to the customer's email.

### 3. 📑 Customer Requests Dashboard (`My Requests`)
* **Request Segregation**: Clear division between **`⏳ Pending Requests`** (awaiting or in active direct chat) and **`✅ Completed Requests`** (resolved cases).
* **Authentication Key Gate**: Customers enter their email Authentication Key to unlock direct 2-way real-time chat sessions with the assigned Higher Official.

### 4. 🛡️ Higher Officials Authentication & Mailbox Isolation
* **Executive Login Portal**: Higher Officials must authenticate with their executive email / ID and security passcode.
* **Mailbox Isolation**:
  * **Dr. Sarah Jenkins** (`sarah.jenkins.executive@glasssupport.com`): Accesses RBAC, governance, and admin privilege requests.
  * **Marcus Vance** (`marcus.vance.director@glasssupport.com`): Accesses wire transfers, tax exemptions, and banking escalations.
  * **Elena Rostova** (`elena.rostova.cso@glasssupport.com`): Accesses data pipelines, CSV exports, and security issues.
* **Live Chat Messenger Console**: Higher Officials reply directly into the customer's chat thread in real-time.
* **One-Click Resolution**: Resolving a request archives it and indexes the solution into the AI knowledge base.

### 5. ⭐ Customer Service Reviews & Satisfaction Hub
* **CSAT 5-Star Rating**: Interactive star rating with feedback categorization.
* **Resolution Status Tracking**: `Fully Resolved`, `Partially Resolved`, or `Not Resolved`.
* **Automatic Emergency Escalation**: Submitting an unresolved review (or rating ≤ 2 stars) instantly opens a priority request on the Higher Officials Desk.

---

## 🏗️ System Architecture

```
+-----------------------------------------------------------------------------------+
| 1. Customer Support Chat (AI Knowledge Base - SQLite FTS5 / BM25)                 |
|    - Verified Solution -> Step-by-Step Resolution                                 |
|    - Privacy / Unresolvable -> Generates Request ID + Auth Key (Sent to Email)    |
+------------------------------------------+----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+---------------------------------------+     +---------------------------------------+
| 2. Customer Requests Dashboard        |     | 3. Higher Officials Portal            |
|    - ⏳ Pending Requests               |     |    - Executive Authentication         |
|    - ✅ Completed Requests             |     |    - Isolated Mailbox per Officer     |
|    - Enter Auth Key -> 2-Way Live Chat|     |    - Live Chat Messenger Console      |
+---------------------------------------+     +---------------------------------------+
```

---

## 🚀 Quickstart Guide

### Prerequisites
* Python 3.9+
* pip

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_ORGANIZATION/glass-customer-support-platform.git
cd glass-customer-support-platform
```

2. **Create and activate a virtual environment:**
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Initialize the SQLite database:**
```bash
python db.py
```

5. **Start the FastAPI server:**
```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

6. **Access the application:**
Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 📖 API Reference

### Customer Chat & Verification
* `POST /api/chat` — Process customer query, returns AI solution or creates escalated executive request.
* `POST /api/verify-otp` — Verifies 2FA code for confidential financial ledger records.

### Customer Requests & Auth Key
* `GET /api/customer/requests/{user_email}` — Retrieves all pending and completed requests for a customer.
* `POST /api/customer/verify-auth-key` — Validates the customer's email Authentication Key to unlock live chat.
* `GET /api/request-thread/{request_id}` — Retrieves full 2-way message history for a request.
* `POST /api/customer/send-message` — Customer sends a message directly to the Higher Official.

### Higher Officials Portal
* `POST /api/official/login` — Authenticates Higher Official executive credentials.
* `GET /api/official/requests?official_email={email}` — Returns requests filtered by the official's mailbox.
* `POST /api/official/reply` — Higher Official dispatches live message to customer thread.
* `POST /api/requests/complete` — Marks a request as completed and archives it.

### Reviews & Analytics
* `POST /api/reviews` — Submits customer satisfaction review (auto-escalates if unresolved).
* `GET /api/reviews` — Lists all verified customer reviews.
* `GET /api/stats` — Real-time KPI statistics.

---

## 🛡️ Security & Privacy Standards
* **Data Isolation**: Requests and conversation transcripts are accessible only by the respective customer and the assigned Higher Official.
* **Authentication Keys**: Unique security keys required before opening direct executive channels.
* **Audit Trail**: Every customer inquiry, AI response, and official message is timestamped and recorded.

---

## 📄 License
This project is licensed under the MIT License.
