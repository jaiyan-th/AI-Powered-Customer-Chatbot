# db.py
"""
Database schema & seeding for GlassSupport:
- Requests & Auth-Key System (Pending vs Completed)
- Live Direct Chat History
- Issues Knowledge Base (FTS5 + BM25)
- Customer Reviews & CSAT
"""

import sqlite3
import os

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "support.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Issues Table (Knowledge Base for AI)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keywords TEXT NOT NULL,
            query_text TEXT NOT NULL,
            solution_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'resolved',
            category TEXT DEFAULT 'General',
            department TEXT DEFAULT 'Customer Support',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Customer Requests Table (Replaces static tickets with dynamic request & auth key sessions)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT UNIQUE NOT NULL,
            auth_key TEXT NOT NULL,
            user_name TEXT DEFAULT 'Customer',
            user_role TEXT DEFAULT 'Member',
            user_email TEXT NOT NULL,
            user_phone TEXT DEFAULT '+1 (415) 890-2134',
            query_title TEXT NOT NULL,
            query_text TEXT NOT NULL,
            query_summary TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' or 'Completed'
            priority TEXT NOT NULL DEFAULT 'Normal',
            is_confidential INTEGER DEFAULT 0,
            department TEXT DEFAULT 'Executive Governance',
            vectors TEXT DEFAULT '🔗 General',
            assigned_official_name TEXT DEFAULT 'Dr. Sarah Jenkins',
            assigned_official_title TEXT DEFAULT 'Chief Governance & Executive Officer',
            assigned_official_email TEXT DEFAULT 'sarah.jenkins.executive@glasssupport.com',
            assigned_official_phone TEXT DEFAULT '+1 (800) 555-0199 (Ext. 401)',
            ai_draft TEXT,
            resolution_notes TEXT,
            confidence_score INTEGER DEFAULT 94,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        );
    """)

    # 3. Chat History & Request Thread Messages Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            user_email TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'assistant', 'official'
            sender_name TEXT DEFAULT 'Assistant',
            content TEXT NOT NULL,
            badge TEXT,
            score REAL,
            department TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 4. Reviews & Satisfaction Feedback Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT DEFAULT 'Customer',
            user_email TEXT NOT NULL,
            rating INTEGER DEFAULT 5,
            issue_faced TEXT NOT NULL,
            is_resolved TEXT NOT NULL DEFAULT 'Fully Resolved',
            service_feedback TEXT,
            unresolved_details TEXT,
            status TEXT DEFAULT 'Reviewed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 5. Group Chat Room Messages Table (Official-Initiated Multi-Party Live Chat)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS room_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            request_id TEXT NOT NULL,
            sender_role TEXT NOT NULL, -- 'official', 'customer', 'system'
            sender_name TEXT NOT NULL,
            sender_email TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Column migration check for requests table
    cursor.execute("PRAGMA table_info(requests);")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if "chat_room_id" not in existing_cols:
        cursor.execute("ALTER TABLE requests ADD COLUMN chat_room_id TEXT;")
    if "chat_status" not in existing_cols:
        cursor.execute("ALTER TABLE requests ADD COLUMN chat_status TEXT DEFAULT 'Awaiting Action';")
    if "call_status" not in existing_cols:
        cursor.execute("ALTER TABLE requests ADD COLUMN call_status TEXT DEFAULT 'Idle';")
    if "call_duration" not in existing_cols:
        cursor.execute("ALTER TABLE requests ADD COLUMN call_duration INTEGER DEFAULT 0;")
    if "call_notes" not in existing_cols:
        cursor.execute("ALTER TABLE requests ADD COLUMN call_notes TEXT;")

    # 5. FTS5 Virtual Table for Search
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
            query_text,
            keywords,
            category,
            department,
            content='issues',
            content_rowid='id'
        );
    """)

    # 6. FTS5 Synchronization Triggers
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues BEGIN
            INSERT INTO issues_fts(rowid, query_text, keywords, category, department) 
            VALUES (new.id, new.query_text, new.keywords, new.category, new.department);
        END;
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS issues_ad AFTER DELETE ON issues BEGIN
            INSERT INTO issues_fts(issues_fts, rowid, query_text, keywords, category, department) 
            VALUES ('delete', old.id, old.query_text, old.keywords, old.category, old.department);
        END;
    """)

    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS issues_au AFTER UPDATE ON issues BEGIN
            INSERT INTO issues_fts(issues_fts, rowid, query_text, keywords, category, department) 
            VALUES ('delete', old.id, old.query_text, old.keywords, old.category, old.department);
            INSERT INTO issues_fts(rowid, query_text, keywords, category, department) 
            VALUES (new.id, new.query_text, new.keywords, new.category, new.department);
        END;
    """)

    conn.commit()

    # Seed initial datasets if empty
    cursor.execute("SELECT COUNT(*) FROM issues;")
    if cursor.fetchone()[0] == 0:
        seed_database(conn)

    cursor.execute("SELECT COUNT(*) FROM requests;")
    if cursor.fetchone()[0] == 0:
        seed_sample_requests(conn)

    cursor.execute("SELECT COUNT(*) FROM chat_history;")
    if cursor.fetchone()[0] == 0:
        seed_sample_chat_history(conn)

    cursor.execute("SELECT COUNT(*) FROM reviews;")
    if cursor.fetchone()[0] == 0:
        seed_sample_reviews(conn)

    conn.close()

def seed_database(conn=None):
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()

    sample_issues = [
        (
            "website down, 502 bad gateway, site not loading, load balancer, vpn, cache",
            "Why is the website showing a 502 Bad Gateway error or not loading?",
            "I see you're trying to resolve a 502 Bad Gateway error on the main dashboard. This usually indicates a temporary routing issue between our load balancers. Let's try to fix this in three steps:\n\n1. Clear your browser cache and cookies for the last hour.\n2. Ensure you are connected to the corporate VPN (Gateway 4).\n3. Attempt a hard refresh (Cmd+Shift+R or Ctrl+F5) on the dashboard page.",
            "Website & IT",
            "Infrastructure & Network Team"
        ),
        (
            "bank transfer failed, money deducted, amount debited, transaction pending, wire",
            "Money was debited from my bank account but transfer status shows pending.",
            "If your bank account was debited but the transaction is pending:\n\n1. **Banking Settlement Window:** Inter-bank ACH/NEFT/RTGS transfers typically settle within **2 to 4 banking hours**.\n2. **Auto-Reversal:** If the transfer fails at the settlement gateway, your bank will automatically reverse the funds within **24 to 48 hours**.\n3. **UTR/ARN Reference:** Retain your 12-digit transaction reference number for reconciliation.",
            "Banking & Finance",
            "Banking Operations Desk"
        ),
        (
            "admin access, rbac mismatch, permissions, role upgrade, team roles",
            "Cannot access admin features or encountering RBAC permission mismatch.",
            "This usually happens when cached user claims mismatch updated workspace roles:\n\n1. Log out and log back in to refresh JWT claims.\n2. Verify you have been assigned the 'Admin' or 'Owner' seat in Workspace Settings.\n3. Contact your organization administrator to re-sync team roles in the identity cluster.",
            "Access & Security",
            "Identity & RBAC Team"
        )
    ]

    for keywords, query_text, solution_text, category, department in sample_issues:
        cursor.execute("""
            INSERT INTO issues (keywords, query_text, solution_text, status, category, department, created_at, resolved_at)
            VALUES (?, ?, ?, 'resolved', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """, (keywords, query_text, solution_text, category, department))

    conn.commit()
    if should_close:
        conn.close()

def seed_sample_requests(conn=None):
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()

    sample_requests = [
        (
            "REQ-8923",
            "AUTH-8923",
            "Alice Chen",
            "VP Engineering @ Tech.io",
            "a.chen@tech.io",
            "+1 (415) 890-2134",
            "Admin Access & RBAC Issue",
            "Cannot access admin controls and role permissions following the RBAC infrastructure upgrade.",
            "Cannot access admin controls following RBAC upgrade ...",
            "Pending",
            "Urgent",
            0,
            "Access & Security",
            "🔗 Auth, 👥 RBAC Mismatch",
            "Dr. Sarah Jenkins",
            "Chief Governance & Executive Officer",
            "sarah.jenkins.executive@glasssupport.com",
            "+1 (800) 555-0199 (Ext. 401)",
            "Hi Alice, I see you're encountering an admin access mismatch following the RBAC upgrade. I've re-synced your team roles in the identity cluster. Please refresh your session.",
            None,
            94
        ),
        (
            "REQ-8924",
            "AUTH-8924",
            "J. Smith",
            "Finance Manager @ Corp.com",
            "j.smith@corp.com",
            "+1 (212) 555-0182",
            "Enterprise Billing Discrepancy",
            "Enterprise billing invoice requires confidential VAT tax exemption adjustment for March 2026.",
            "Enterprise billing invoice VAT exemption ...",
            "Pending",
            "Urgent",
            1,
            "Finance & Billing",
            "💳 Billing, 🔒 Tax Exemption",
            "Marcus Vance",
            "Director of Banking & Financial Integrity",
            "marcus.vance.director@glasssupport.com",
            "+1 (888) 452-7722 (Direct)",
            "Hi J. Smith, I have reviewed your enterprise statement and applied the verified tax exemption certificate to your account ledger.",
            None,
            96
        ),
        (
            "REQ-8920",
            "AUTH-8920",
            "R. Woods",
            "Lead Designer @ Design.co",
            "r.woods@design.co",
            "+1 (650) 555-0199",
            "Data Export Format Mismatch",
            "Data export format is generating truncated CSV files on high volume queries.",
            "Data export format generating truncated CSV ...",
            "Completed",
            "Normal",
            0,
            "Infrastructure & Data",
            "📊 Data Pipeline, 📁 CSV Export",
            "Elena Rostova",
            "Head of Enterprise Security & Data Integrity",
            "elena.rostova.cso@glasssupport.com",
            "+1 (800) 555-0844 (Ext. 102)",
            "Hi R. Woods, our pipeline team has increased the CSV streaming buffer ceiling to resolve truncated exports.",
            "Increased CSV streaming buffer ceiling to 50MB. Customer verified export working.",
            91
        ),
        (
            "REQ-8915",
            "AUTH-8915",
            "customer@example.com",
            "Guest Member",
            "customer@example.com",
            "+1 (800) 555-0199",
            "502 Gateway Resolution Confirmation",
            "502 Bad Gateway error on main dashboard.",
            "502 Bad Gateway resolved after VPN cache purge ...",
            "Completed",
            "Normal",
            0,
            "Website & IT",
            "🌐 Network, ⚙️ 502 Error",
            "Dr. Sarah Jenkins",
            "Chief Governance & Executive Officer",
            "sarah.jenkins.executive@glasssupport.com",
            "+1 (800) 555-0199 (Ext. 401)",
            "Cleared load balancer proxy session. Verified uptime 99.98%.",
            "Proxy session purged. Operational health confirmed.",
            98
        )
    ]

    for req in sample_requests:
        cursor.execute("""
            INSERT INTO requests (
                request_id, auth_key, user_name, user_role, user_email, user_phone, query_title, query_text, query_summary,
                status, priority, is_confidential, department, vectors, assigned_official_name, assigned_official_title,
                assigned_official_email, assigned_official_phone, ai_draft, resolution_notes, confidence_score, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
        """, req)

    conn.commit()
    if should_close:
        conn.close()

def seed_sample_chat_history(conn=None):
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()

    sample_chats = [
        ("REQ-8923", "a.chen@tech.io", "user", "Alice Chen", "Cannot access admin controls and role permissions following the RBAC infrastructure upgrade.", None, None, "Access & Security"),
        ("REQ-8923", "a.chen@tech.io", "assistant", "GlassSupport AI", "I couldn't resolve this automatically. An active request REQ-8923 has been created. Your Authentication Key `AUTH-8923` has been sent to your email. Connected you to Dr. Sarah Jenkins.", "Connected to Higher Official", 94.0, "Access & Security"),
        ("REQ-8923", "a.chen@tech.io", "official", "Dr. Sarah Jenkins", "Hello Alice, I have opened a secure direct executive session for your case REQ-8923. I am re-syncing your team roles now.", "👑 Higher Official", None, "Executive Desk"),
        ("REQ-8924", "j.smith@corp.com", "user", "J. Smith", "Enterprise billing invoice requires confidential VAT tax exemption adjustment for March 2026.", None, None, "Finance & Billing"),
        ("REQ-8924", "j.smith@corp.com", "assistant", "GlassSupport AI", "🔒 Confidentiality Protected. Direct request REQ-8924 opened. Authentication Key `AUTH-8924` sent to j.smith@corp.com. Dispatched to Marcus Vance.", "Privacy Protected", None, "Finance & Billing")
    ]

    for req_id, user_email, role, sender, content, badge, score, dept in sample_chats:
        cursor.execute("""
            INSERT INTO chat_history (request_id, user_email, role, sender_name, content, badge, score, department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
        """, (req_id, user_email, role, sender, content, badge, score, dept))

    conn.commit()
    if should_close:
        conn.close()

def seed_sample_reviews(conn=None):
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()

    sample_reviews = [
        ("Alice Chen", "a.chen@tech.io", 5, "RBAC Permissions & Admin Access", "Fully Resolved", "The Higher Official connected directly using my Auth Key and re-synced the identity cluster in 5 minutes! Outstanding support.", None, "Reviewed"),
        ("J. Smith", "j.smith@corp.com", 4, "Enterprise Tax Exemption Discrepancy", "Fully Resolved", "Director Marcus Vance followed up via official email and updated the statement.", None, "Reviewed"),
        ("Marcus Brody", "marcus.b@logistics.net", 2, "Payment Gateway Timeout", "Not Resolved", "Bank deducted funds but invoice status is still unpaid after 3 hours. Need immediate intervention.", "Transaction ref #TXN-99411 stuck at payment processor. Need manual release.", "Requires Escalation")
    ]

    for user_name, user_email, rating, issue_faced, is_resolved, feedback, unresolved_details, status in sample_reviews:
        cursor.execute("""
            INSERT INTO reviews (user_name, user_email, rating, issue_faced, is_resolved, service_feedback, unresolved_details, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
        """, (user_name, user_email, rating, issue_faced, is_resolved, feedback, unresolved_details, status))

    conn.commit()
    if should_close:
        conn.close()

if __name__ == "__main__":
    init_db()
    print("Database freshly initialized with Request & Auth-Key System.")
