// static/app.js
// Complete Controller for GlassSupport Request & Authentication Key Architecture

let activeUserEmail = "a.chen@tech.io";
let currentRequestTab = "pending";
let officialQueueTab = "pending";
let allOfficialRequests = { pending: [], completed: [] };
let selectedOfficialRequestId = null;
let currentVerifyingRequestId = null;
let currentActiveSessionRequestId = null;
let isVoiceEnabled = true;
let isRecording = false;
let recognition = null;

document.addEventListener("DOMContentLoaded", () => {
    initSpeechRecognition();
    loadCustomerRequests();
    loadOfficialDashboard();
    loadCustomerReviews();

    // Check for ?room= in URL to automatically join live chat room
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        setTimeout(() => {
            openRoomModal(roomParam, "Higher Official", activeUserEmail.split("@")[0].capitalize());
            showToast(`💬 Joined Live Chat Room: ${roomParam}`, "success");
        }, 600);
    }
});

// -----------------------------------------------------------------------------
// Voice Recognition & Text-to-Speech
// -----------------------------------------------------------------------------
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            const btn = document.getElementById("btn-voice-mic");
            if (btn) btn.style.color = "#DC2626";
            showToast("🎙️ Listening... Speak your issue now", "info");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById("chat-input");
            input.value = transcript;
            showToast(`Recognized: "${transcript}"`, "success");
            handleChatSubmit(new Event("submit"));
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            stopVoiceRecording();
        };

        recognition.onend = () => {
            stopVoiceRecording();
        };
    }
}

function toggleVoiceRecording() {
    if (!recognition) {
        showToast("Voice recognition is not supported in this browser.", "error");
        return;
    }
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function stopVoiceRecording() {
    isRecording = false;
    const btn = document.getElementById("btn-voice-mic");
    if (btn) btn.style.color = "#64748B";
}

function toggleVoiceSpeech() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById("btn-tts-toggle");
    if (isVoiceEnabled) {
        btn.style.color = "#4338CA";
        showToast("🔊 Voice Response Enabled", "info");
    } else {
        btn.style.color = "#94A3B8";
        window.speechSynthesis.cancel();
        showToast("🔇 Voice Response Muted", "info");
    }
}

function speakText(text) {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>?/gm, '').replace(/[*_`#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText.substring(0, 240));
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
}

// -----------------------------------------------------------------------------
// View Switching & User Switching
// -----------------------------------------------------------------------------
function switchView(viewName) {
    document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".content-view").forEach(el => el.classList.remove("active"));

    if (viewName === "chat") {
        document.getElementById("tab-chat").classList.add("active");
        document.getElementById("view-chat").classList.add("active");
    } else if (viewName === "requests") {
        document.getElementById("tab-requests").classList.add("active");
        document.getElementById("view-requests").classList.add("active");
        loadCustomerRequests();
    } else if (viewName === "dashboard") {
        document.getElementById("tab-dashboard").classList.add("active");
        document.getElementById("view-dashboard").classList.add("active");
        loadOfficialDashboard();
    } else if (viewName === "reviews") {
        document.getElementById("tab-reviews").classList.add("active");
        document.getElementById("view-reviews").classList.add("active");
        loadCustomerReviews();
    }
}

function onUserIdentityChanged(email) {
    activeUserEmail = email;
    const revEmailInput = document.getElementById("rev-user-email");
    if (revEmailInput) revEmailInput.value = email;
    const revNameInput = document.getElementById("rev-user-name");
    if (revNameInput) revNameInput.value = email.split("@")[0].capitalize();

    showToast(`Switched active user: ${email}`, "info");
    loadCustomerRequests();
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function formatText(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
        .replace(/\*(.*?)\*/g, "<i>$1</i>")
        .replace(/`(.*?)`/g, "<code style='background:#F1F5F9;padding:2px 6px;border-radius:4px;color:#4338CA;font-weight:700;'>$1</code>")
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");
}

// -----------------------------------------------------------------------------
// VIEW 1: Customer Chat Submission
// -----------------------------------------------------------------------------
async function handleChatSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const input = document.getElementById("chat-input");
    const query = input.value.trim();
    if (!query) return;

    input.value = "";
    const stream = document.getElementById("chat-stream");

    // Append user bubble
    stream.insertAdjacentHTML("beforeend", `
        <div class="msg-user-group">
            <div class="user-bubble"><p>${query}</p></div>
        </div>
    `);

    const typing = document.getElementById("typing-indicator");
    typing.classList.remove("hidden");

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, email: activeUserEmail })
        });
        const data = await res.json();
        typing.classList.add("hidden");

        if (data.requires_otp) {
            openOTPModal(activeUserEmail);
        }

        let badgeHTML = "";
        let actionCardHTML = "";

        if (data.matched) {
            badgeHTML = `<span class="badge-high-match-green"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> HIGH MATCH (${data.score || 98}% CONFIDENCE)</span>`;
        } else if (data.requires_contact) {
            badgeHTML = `<span class="badge-high-match-green" style="background:#FEF3C7;color:#92400E;">⚠️ ESCALATION REQUIRED</span>`;
            const off = data.assigned_official || {
                name: "Dr. Sarah Jenkins",
                title: "Chief Governance & Executive Officer",
                email: "sarah.jenkins.executive@glasssupport.com"
            };
            const formId = "esc-form-" + Date.now();
            const safeQuery = query.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const defaultName = activeUserEmail.split("@")[0].capitalize();

            actionCardHTML = `
                <div id="${formId}" style="background:#F8FAFC;border:1px solid #CBD5E1;border-left:4px solid #4338CA;border-radius:12px;padding:14px;margin-top:12px;">
                    <div style="font-weight:800;font-size:0.85rem;color:#1E293B;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                        <span>👑 ESCALATE INQUIRY TO HIGHER OFFICIAL</span>
                    </div>
                    <p style="font-size:0.78rem;color:#64748B;margin-bottom:10px;line-height:1.4;">
                        Our chatbot cannot answer this question directly. Please provide your contact details below so <b>${off.name}</b> (${off.title}) can review your inquiry, contact you via email (<b>${off.email}</b>), and start a live chat session with you.
                    </p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                        <div>
                            <label style="font-size:0.72rem;font-weight:700;color:#475569;display:block;margin-bottom:2px;">Your Full Name:</label>
                            <input type="text" id="${formId}-name" value="${defaultName}" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:6px;padding:7px 10px;font-size:0.82rem;" placeholder="e.g. Alice Chen">
                        </div>
                        <div>
                            <label style="font-size:0.72rem;font-weight:700;color:#475569;display:block;margin-bottom:2px;">Your Email Address:</label>
                            <input type="email" id="${formId}-email" value="${activeUserEmail}" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:6px;padding:7px 10px;font-size:0.82rem;" placeholder="e.g. user@company.com">
                        </div>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:0.72rem;font-weight:700;color:#475569;display:block;margin-bottom:2px;">Your Phone Number:</label>
                        <input type="tel" id="${formId}-phone" value="+1 (555) 019-2834" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:6px;padding:7px 10px;font-size:0.82rem;" placeholder="e.g. +1 (555) 234-5678 or mobile number">
                    </div>
                    <button type="button" class="btn-primary" style="padding:8px 16px;font-size:0.82rem;font-weight:700;display:flex;align-items:center;gap:6px;" onclick="submitCustomerEscalation('${formId}', '${safeQuery}')">
                        🚀 Submit Details to Higher Official
                    </button>
                </div>
            `;
        } else {
            // Connected to Higher Official with Auth Key
            badgeHTML = `<span class="badge-high-match-green" style="background:#FEE2E2;color:#DC2626;">🔒 CONNECTED TO HIGHER OFFICIAL (${data.request_id || ''})</span>`;
            const off = data.assigned_official || {};
            actionCardHTML = `
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-left:4px solid #DC2626;border-radius:12px;padding:12px;margin-top:12px;">
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;font-weight:800;color:#DC2626;margin-bottom:6px;">
                        <span>👑 DESIGNATED HIGHER OFFICIAL CONTACT</span>
                    </div>
                    <div style="font-weight:800;font-size:0.92rem;color:#0F172A;">${off.name || 'Higher Official'}</div>
                    <div style="font-size:0.75rem;color:#64748B;margin-bottom:8px;">${off.title || 'Executive'}</div>
                    <div style="display:flex;gap:8px;font-size:0.78rem;margin-bottom:10px;">
                        <a href="mailto:${off.email}" style="color:#4338CA;text-decoration:none;font-weight:700;background:#F8FAFC;padding:3px 8px;border-radius:6px;">✉️ ${off.email || ''}</a>
                        <a href="tel:${off.phone}" style="color:#4338CA;text-decoration:none;font-weight:700;background:#F8FAFC;padding:3px 8px;border-radius:6px;">📞 ${off.phone || ''}</a>
                    </div>
                    
                    <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.78rem;color:#92400E;">
                        🔑 <b>Authentication Key:</b> <code style="font-weight:800;font-size:0.9rem;color:#78350F;">${data.auth_key}</code> <i>(Sent to ${activeUserEmail})</i>
                    </div>

                    <div style="display:flex;gap:8px;">
                        <button type="button" class="btn-primary" style="padding:6px 12px;font-size:0.8rem;" onclick="promptAuthKeyToChat('${data.request_id}', '${data.auth_key}', '${off.name}')">
                            🔑 Continue Live Chat with Higher Official
                        </button>
                        <button type="button" class="btn-cancel" style="padding:6px 12px;font-size:0.8rem;" onclick="switchView('requests')">
                            📑 View in My Requests
                        </button>
                    </div>
                </div>
            `;
        }

        const botHTML = `
            <div class="msg-bot-group">
                <div class="bot-icon-circle">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2">
                        <rect x="3" y="11" width="18" height="10" rx="2"/>
                        <circle cx="12" cy="5" r="2"/>
                        <path d="M12 7v4"/>
                        <line x1="8" y1="16" x2="8.01" y2="16"/>
                        <line x1="16" y1="16" x2="16.01" y2="16"/>
                    </svg>
                </div>
                <div class="bot-card-content">
                    <div class="bot-card-header">
                        <span class="bot-title">GlassSupport AI</span>
                        ${badgeHTML}
                    </div>
                    <div class="bot-card-body">
                        <div>${formatText(data.answer)}</div>
                        ${actionCardHTML}
                    </div>
                    <div class="bot-card-footer">
                        <span class="feedback-prompt">Did this resolve your issue?</span>
                        <div class="feedback-btn-row">
                            <button class="btn-feedback" onclick="sendFeedback(true)">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                Yes, it worked
                            </button>
                            <button class="btn-feedback" onclick="sendFeedback(false)">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
                                No, still broken
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        stream.insertAdjacentHTML("beforeend", botHTML);
        speakText(data.answer);

    } catch (err) {
        typing.classList.add("hidden");
        showToast("Error connecting to support backend: " + err.message, "error");
    }
}

async function submitCustomerEscalation(formId, queryText) {
    const nameInput = document.getElementById(`${formId}-name`);
    const emailInput = document.getElementById(`${formId}-email`);
    const phoneInput = document.getElementById(`${formId}-phone`);

    const name = nameInput ? nameInput.value.trim() : "Customer";
    const email = emailInput ? emailInput.value.trim() : activeUserEmail;
    const phone = phoneInput ? phoneInput.value.trim() : "Not Provided";

    if (!email) {
        showToast("Please enter a valid email address.", "error");
        return;
    }
    if (!phone) {
        showToast("Please enter a contact phone number.", "error");
        return;
    }

    try {
        const res = await fetch("/api/escalate-to-official", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_name: name,
                user_email: email,
                user_phone: phone,
                query: queryText
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ Escalated to Higher Official ${data.assigned_official.name}!`, "success");
            activeUserEmail = email;

            const formCard = document.getElementById(formId);
            if (formCard) {
                formCard.innerHTML = `
                    <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:10px;padding:12px;margin-top:6px;">
                        <div style="font-weight:800;color:#065F46;font-size:0.85rem;margin-bottom:6px;">
                            ✅ Successfully Forwarded to Higher Official!
                        </div>
                        <div style="font-size:0.78rem;color:#047857;line-height:1.4;margin-bottom:8px;">
                            Your inquiry, contact phone (<b>${data.customer.phone}</b>), and email have been dispatched to <b>${data.assigned_official.name}</b> (${data.assigned_official.title}). The official will contact you via email and can launch a live chat session.
                        </div>
                        <div style="background:#FFFFFF;border:1px solid #A7F3D0;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:0.8rem;color:#065F46;">
                            🔑 <b>Your Authentication Key:</b> <code style="font-weight:800;color:#047857;font-size:0.9rem;">${data.auth_key}</code> 
                            &bull; <b>Ticket ID:</b> <code>${data.request_id}</code>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button type="button" class="btn-primary" style="padding:6px 12px;font-size:0.8rem;" onclick="promptAuthKeyToChat('${data.request_id}', '${data.auth_key}', '${data.assigned_official.name}')">
                                🔑 Continue Live Chat
                            </button>
                            <button type="button" class="btn-cancel" style="padding:6px 12px;font-size:0.8rem;" onclick="switchView('requests')">
                                📑 View in My Requests
                            </button>
                        </div>
                    </div>
                `;
            }

            loadCustomerRequests();
            loadOfficialDashboard();
        }
    } catch (err) {
        showToast("Error escalating to official: " + err.message, "error");
    }
}

function sendFeedback(worked) {
    if (worked) {
        showToast("Glad to hear that resolved your issue! 😊", "success");
        speakText("Glad to hear that resolved your issue!");
    } else {
        showToast("Escalating to Higher Officials and creating direct request session...", "info");
        switchView("requests");
    }
}

// -----------------------------------------------------------------------------
// VIEW 2: Customer Requests Dashboard (Pending vs Completed)
// -----------------------------------------------------------------------------
async function loadCustomerRequests() {
    try {
        const res = await fetch(`/api/customer/requests/${encodeURIComponent(activeUserEmail)}`);
        const data = await res.json();

        const pendingList = data.pending || [];
        const completedList = data.completed || [];

        document.getElementById("badge-pending-count").innerText = pendingList.length;
        document.getElementById("badge-completed-count").innerText = completedList.length;

        renderCustomerRequestsGrid(currentRequestTab === "pending" ? pendingList : completedList);

    } catch (err) {
        console.error("Error loading customer requests:", err);
    }
}

function switchRequestTab(tab) {
    currentRequestTab = tab;
    document.getElementById("btn-tab-pending").classList.toggle("active", tab === "pending");
    document.getElementById("btn-tab-completed").classList.toggle("active", tab === "completed");
    loadCustomerRequests();
}

function renderCustomerRequestsGrid(requests) {
    const grid = document.getElementById("customer-requests-grid");
    if (!requests || requests.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;color:#94A3B8;">
                <div style="font-size:2rem;margin-bottom:8px;">📑</div>
                <div style="font-weight:700;font-size:1rem;color:#0F172A;">No ${currentRequestTab} requests found</div>
                <div style="font-size:0.82rem;margin-top:4px;">When a query cannot be answered automatically, your request and Authentication Key will appear here.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = requests.map(req => {
        const isPending = req.status === "Pending";
        const statusClass = isPending ? "pending" : "completed";
        const statusLabel = isPending ? "⏳ Pending Official Chat" : "✅ Completed";

        const roomAlert = req.chat_room_id ? `
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:6px 10px;margin:8px 0;font-size:0.75rem;color:#065F46;display:flex;align-items:center;justify-content:space-between;">
                <span>💬 <b>Chat Room Created:</b> ${req.chat_room_id}</span>
                <button type="button" style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.72rem;" onclick="openRoomModal('${req.chat_room_id}', '${req.assigned_official_name}', '${req.user_name || req.user_email}')">Join Room ➔</button>
            </div>
        ` : '';

        const callNotice = (req.call_status && req.call_status !== 'Idle') ? `
            <div style="font-size:0.72rem;color:#0284C7;font-weight:700;margin-bottom:6px;">
                📞 Voice Call: ${req.call_status} ${req.call_duration ? '(' + req.call_duration + 's)' : ''}
            </div>
        ` : '';

        return `
            <div class="request-card-item">
                <div>
                    <div class="req-card-top">
                        <span class="req-id-tag">${req.request_id}</span>
                        <span class="req-status-pill ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="req-title">${req.query_title}</div>
                    <div class="req-snippet">${req.query_summary}</div>
                    
                    <div class="req-official-row">
                        <span>👑 <strong>${req.assigned_official_name}</strong></span>
                        <span style="color:#64748B;font-size:0.7rem;">(${req.assigned_official_title})</span>
                    </div>

                    <div class="req-auth-key-notice">
                        🔑 <span>Auth Key: <strong>${req.auth_key}</strong></span>
                    </div>

                    ${roomAlert}
                    ${callNotice}
                </div>

                <div>
                    <button class="btn-resume-chat" onclick="promptAuthKeyToChat('${req.request_id}', '${req.auth_key}', '${req.assigned_official_name}')">
                        ${isPending ? '🔑 Enter Key & Continue Chat' : '💬 View Chat History'}
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// -----------------------------------------------------------------------------
// Authentication Key Verification & Live Session Window
// -----------------------------------------------------------------------------
function promptAuthKeyToChat(requestId, prefilledAuthKey, officialName) {
    currentVerifyingRequestId = requestId;
    document.getElementById("modal-req-id-label").innerText = requestId;
    document.getElementById("modal-auth-key-input").value = prefilledAuthKey || "";
    document.getElementById("auth-key-modal").classList.remove("hidden");
}

function closeAuthKeyModal() {
    document.getElementById("auth-key-modal").classList.add("hidden");
}

async function submitAuthKeyVerification() {
    const key = document.getElementById("modal-auth-key-input").value.trim();
    if (!key) {
        showToast("Please enter the Authentication Key.", "error");
        return;
    }

    try {
        const res = await fetch("/api/customer/verify-auth-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: currentVerifyingRequestId,
                auth_key: key,
                user_email: activeUserEmail
            })
        });
        const data = await res.json();

        if (data.success) {
            closeAuthKeyModal();
            showToast("🔑 Authentication Key Verified! Opening direct chat...", "success");
            openLiveSessionModal(currentVerifyingRequestId, data.request.assigned_official_name || "Dr. Sarah Jenkins");
        }
    } catch (err) {
        showToast("Invalid Authentication Key. Please check the key sent to your email.", "error");
    }
}

async function openLiveSessionModal(requestId, officialName) {
    currentActiveSessionRequestId = requestId;
    document.getElementById("session-official-name").innerText = officialName;
    document.getElementById("session-req-badge").innerText = requestId;
    document.getElementById("live-session-modal").classList.remove("hidden");

    await reloadSessionMessages();
}

function closeLiveSessionModal() {
    document.getElementById("live-session-modal").classList.add("hidden");
    currentActiveSessionRequestId = null;
}

async function reloadSessionMessages() {
    if (!currentActiveSessionRequestId) return;
    try {
        const res = await fetch(`/api/request-thread/${encodeURIComponent(currentActiveSessionRequestId)}`);
        const data = await res.json();
        const messages = data.messages || [];

        const stream = document.getElementById("session-messages-stream");
        if (messages.length === 0) {
            stream.innerHTML = `<div style="text-align:center;padding:2rem;color:#94A3B8;font-size:0.85rem;">No messages in this session yet. Type a message below to start speaking directly with the Higher Official.</div>`;
            return;
        }

        stream.innerHTML = messages.map(msg => {
            const isOfficial = msg.role === "official";
            const isUser = msg.role === "user";

            if (isUser) {
                return `
                    <div style="display:flex;justify-content:flex-end;">
                        <div style="background:#3730A3;color:#FFFFFF;padding:8px 14px;border-radius:14px;border-top-right-radius:2px;max-width:80%;font-size:0.84rem;line-height:1.4;">
                            <div>${formatText(msg.content)}</div>
                            <div style="font-size:0.65rem;color:rgba(255,255,255,0.7);text-align:right;margin-top:2px;">${msg.created_at || ''}</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                        <div style="width:32px;height:32px;border-radius:50%;background:#FEF3C7;border:1px solid #FCD34D;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;">👑</div>
                        <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;border-top-left-radius:2px;padding:10px 14px;max-width:80%;font-size:0.84rem;line-height:1.4;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size:0.75rem;font-weight:800;color:#0F172A;margin-bottom:2px;">${msg.sender_name || 'Higher Official'}</div>
                            <div style="color:#1E293B;">${formatText(msg.content)}</div>
                            <div style="font-size:0.65rem;color:#94A3B8;margin-top:4px;">${msg.created_at || ''}</div>
                        </div>
                    </div>
                `;
            }
        }).join("");

        stream.scrollTop = stream.scrollHeight;

    } catch (err) {
        console.error("Error loading session messages:", err);
    }
}

async function handleSessionCustomerSend(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById("session-customer-input");
    const msg = input.value.trim();
    if (!msg || !currentActiveSessionRequestId) return;

    input.value = "";

    try {
        const res = await fetch("/api/customer/send-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: currentActiveSessionRequestId,
                user_email: activeUserEmail,
                message: msg
            })
        });
        const data = await res.json();
        if (data.success) {
            await reloadSessionMessages();
            loadOfficialDashboard();
        }
    } catch (err) {
        showToast("Error sending message: " + err.message, "error");
    }
}

// -----------------------------------------------------------------------------
// VIEW 3: Higher Officials Portal & Login Authentication
// -----------------------------------------------------------------------------
let currentLoggedInOfficial = {
    name: "Dr. Sarah Jenkins",
    title: "Chief Governance & Executive Officer",
    email: "sarah.jenkins.executive@glasssupport.com",
    phone: "+1 (800) 555-0199 (Ext. 401)",
    dept: "Executive Governance & Privacy"
};

function selectOfficialPreset(email, name) {
    document.querySelectorAll(".preset-card").forEach(c => c.classList.remove("active"));
    const cards = document.querySelectorAll(".preset-card");
    cards.forEach(c => {
        if (c.innerHTML.includes(email)) c.classList.add("active");
    });
    const emailInput = document.getElementById("official-login-email");
    if (emailInput) emailInput.value = email;
}

async function handleOfficialLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const email = document.getElementById("official-login-email").value.trim();
    const passcode = document.getElementById("official-login-passcode").value.trim();

    try {
        const res = await fetch("/api/official/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, passcode: passcode })
        });
        const data = await res.json();

        if (data.success) {
            currentLoggedInOfficial = data.official;
            showToast(`✅ Logged in as ${data.official.name}!`, "success");
            updateOfficialUIState();
            loadOfficialDashboard();
        }
    } catch (err) {
        showToast("Invalid executive credentials. Please check your official email.", "error");
    }
}

function logoutHigherOfficial() {
    currentLoggedInOfficial = null;
    showToast("🚪 Higher Official logged out.", "info");
    updateOfficialUIState();
}

function updateOfficialUIState() {
    const loginCard = document.getElementById("official-login-card");
    const inboxView = document.getElementById("official-inbox-view");

    if (!currentLoggedInOfficial) {
        loginCard.classList.remove("hidden");
        inboxView.classList.add("hidden");
    } else {
        loginCard.classList.add("hidden");
        inboxView.classList.remove("hidden");

        document.getElementById("hdr-official-name").innerText = currentLoggedInOfficial.name;
        document.getElementById("hdr-official-email").innerText = currentLoggedInOfficial.email;
        document.getElementById("hdr-official-tag").innerText = `${currentLoggedInOfficial.title.toUpperCase()}`;
    }
}

async function loadOfficialDashboard() {
    updateOfficialUIState();
    if (!currentLoggedInOfficial) return;

    try {
        const url = `/api/official/requests?official_email=${encodeURIComponent(currentLoggedInOfficial.email)}`;
        const res = await fetch(url);
        const data = await res.json();
        allOfficialRequests = data;

        document.getElementById("kpi-urgent-count").innerText = data.total_pending || 0;
        document.getElementById("kpi-closed-today").innerText = data.total_completed || 0;

        renderOfficialQueue();

        const firstPending = (data.pending && data.pending.length > 0) ? data.pending[0] : (data.completed ? data.completed[0] : null);
        if (firstPending && (!selectedOfficialRequestId || !findRequestById(selectedOfficialRequestId))) {
            selectOfficialRequest(firstPending.request_id);
        }

        populateOfficialUserFilter();

    } catch (err) {
        console.error("Error loading official dashboard:", err);
    }
}

function switchOfficialQueueTab(tab) {
    officialQueueTab = tab;
    document.getElementById("subtab-official-pending").classList.toggle("active", tab === "pending");
    document.getElementById("subtab-official-completed").classList.toggle("active", tab === "completed");
    renderOfficialQueue();
}

function renderOfficialQueue() {
    const list = officialQueueTab === "pending" ? allOfficialRequests.pending : allOfficialRequests.completed;
    const tbody = document.getElementById("official-queue-tbody");

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94A3B8;">No ${officialQueueTab} requests in queue.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(req => {
        const isSelected = selectedOfficialRequestId === req.request_id;
        const initial = req.user_name ? req.user_name.substring(0, 2).toUpperCase() : req.user_email[0].toUpperCase();
        const statusBadge = req.status === "Pending" ? `<span class="req-status-pill pending">PENDING</span>` : `<span class="req-status-pill completed">SOLVED</span>`;

        return `
            <tr class="${isSelected ? 'active-row' : ''}" onclick="selectOfficialRequest('${req.request_id}')">
                <td class="table-id-cell">${req.request_id}</td>
                <td>
                    <div class="table-user-cell">
                        <span class="user-init-avatar">${initial}</span>
                        <div>
                            <div style="font-weight:700;color:#0F172A;font-size:0.84rem;">${req.user_name || 'Customer'}</div>
                            <div style="font-size:0.7rem;color:#64748B;">${req.user_email} • ${req.user_phone || ''}</div>
                        </div>
                    </div>
                </td>
                <td style="color:#475569;font-size:0.8rem;">
                    <div>${req.query_summary}</div>
                    ${req.status === 'Completed' && req.resolution_notes ? `<div style="font-size:0.7rem;color:#059669;margin-top:2px;"><b>Resolution:</b> ${req.resolution_notes.substring(0, 45)}...</div>` : ''}
                </td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join("");
}

function findRequestById(requestId) {
    const all = [...(allOfficialRequests.pending || []), ...(allOfficialRequests.completed || [])];
    return all.find(r => r.request_id === requestId);
}

function selectOfficialRequest(requestId) {
    const req = findRequestById(requestId);
    if (!req) return;

    selectedOfficialRequestId = requestId;
    renderOfficialQueue();

    // Populate Right Panel
    document.getElementById("panel-request-id").innerText = req.request_id;
    document.getElementById("panel-auth-key").innerText = req.auth_key;
    document.getElementById("panel-badge-status").innerText = req.status === "Pending" ? "PENDING REQUEST" : "SOLVED / COMPLETED";
    document.getElementById("panel-issue-title").innerText = req.query_title;
    
    // Customer Contact Details
    const nameEl = document.getElementById("panel-customer-name");
    if (nameEl) nameEl.innerText = req.user_name || req.user_email.split("@")[0];
    const emailEl = document.getElementById("panel-customer-email");
    if (emailEl) emailEl.innerText = req.user_email;
    const phoneEl = document.getElementById("panel-customer-phone");
    if (phoneEl) phoneEl.innerText = req.user_phone || "Not Provided";
    const queryEl = document.getElementById("panel-customer-full-query");
    if (queryEl) queryEl.innerText = req.query_text || req.query_summary || req.query_title;
    
    document.getElementById("panel-customer-role").innerText = req.user_role || "Member";
    document.getElementById("panel-customer-avatar").innerText = req.user_name ? req.user_name.substring(0, 2).toUpperCase() : "AC";
    
    document.getElementById("panel-draft-confidence").innerText = `${req.confidence_score || 94}% CONFIDENCE`;

    const vectorChips = document.getElementById("panel-vector-chips");
    const vList = req.vectors ? req.vectors.split(",") : ["🔗 General", "⚡ Request"];
    vectorChips.innerHTML = vList.map(v => `<span class="vector-chip">${v.trim()}</span>`).join("");

    document.getElementById("panel-ai-draft-body").innerText = req.ai_draft || "Hi, I have reviewed your request and am working on resolving it for you.";
    document.getElementById("desk-response-input").value = "";

    // Toggle Room Status & Active Notice & Share Link
    const roomBanner = document.getElementById("room-active-banner");
    const convStatus = document.getElementById("panel-conv-status");
    const shareLinkInput = document.getElementById("panel-share-link-input");

    if (req.chat_room_id) {
        roomBanner.classList.remove("hidden");
        document.getElementById("panel-active-room-id").innerText = req.chat_room_id;
        convStatus.innerText = "ROOM ACTIVE";
        convStatus.style.background = "#DCFCE7";
        convStatus.style.color = "#15803D";
        if (shareLinkInput) {
            shareLinkInput.value = `${window.location.origin}/?room=${encodeURIComponent(req.chat_room_id)}&req=${encodeURIComponent(req.request_id)}`;
        }
    } else {
        roomBanner.classList.add("hidden");
        convStatus.innerText = "AWAITING ACTION";
        convStatus.style.background = "#E0E7FF";
        convStatus.style.color = "#3730A3";
        if (shareLinkInput) shareLinkInput.value = "";
    }

    // Toggle Pending vs Completed Actions
    const compBox = document.getElementById("panel-completed-notes-box");
    const compText = document.getElementById("panel-completed-notes-text");
    const btnSolved = document.getElementById("btn-mark-request-solved");
    const btnReply = document.getElementById("btn-send-official-reply");

    if (req.status === "Completed") {
        if (compBox) compBox.classList.remove("hidden");
        if (compText) compText.innerText = req.resolution_notes || "Resolved and verified by Higher Official.";
        if (btnSolved) {
            btnSolved.innerText = "✅ Solved";
            btnSolved.disabled = true;
            btnSolved.style.opacity = "0.6";
        }
    } else {
        if (compBox) compBox.classList.add("hidden");
        if (btnSolved) {
            btnSolved.innerText = "✅ Mark as Solved";
            btnSolved.disabled = false;
            btnSolved.style.opacity = "1";
        }
    }

    // Load conversation thread in drawer
    loadOfficialThreadMessages(req.request_id, req.user_email);
}

async function loadOfficialThreadMessages(requestId, userEmail) {
    document.getElementById("audit-user-name").innerText = `${userEmail} (${requestId})`;
    try {
        const res = await fetch(`/api/request-thread/${encodeURIComponent(requestId)}`);
        const data = await res.json();
        const messages = data.messages || [];

        const feed = document.getElementById("audit-chat-feed");
        if (messages.length === 0) {
            feed.innerHTML = `<div style="color:#94A3B8;text-align:center;padding:1rem;">No conversation logs found for ${requestId}.</div>`;
            return;
        }

        feed.innerHTML = messages.map(item => `
            <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:6px;padding:8px 10px;margin-bottom:6px;">
                <div style="display:flex;justify-content:space-between;font-size:0.68rem;font-weight:700;color:#64748B;margin-bottom:2px;">
                    <span>${item.role === 'user' ? '🧑‍💻 Customer' : '👑 Higher Official'}</span>
                    <span>${item.created_at || ''}</span>
                </div>
                <div style="font-size:0.8rem;color:#1E293B;">${formatText(item.content)}</div>
            </div>
        `).join("");

    } catch (err) {
        console.error("Error loading official thread:", err);
    }
}

function reloadSelectedRequestThread() {
    if (selectedOfficialRequestId) {
        const req = findRequestById(selectedOfficialRequestId);
        if (req) loadOfficialThreadMessages(req.request_id, req.user_email);
        showToast("Reloaded request transcript thread.", "info");
    }
}

function applyAIDraft() {
    const req = findRequestById(selectedOfficialRequestId);
    if (!req) return;
    document.getElementById("desk-response-input").value = req.ai_draft || "";
    showToast("AI Draft applied to message console.", "info");
}

async function sendOfficialLiveReply() {
    if (!selectedOfficialRequestId) {
        showToast("Please select a request from the queue first.", "error");
        return;
    }

    const input = document.getElementById("desk-response-input");
    const msg = input.value.trim();
    if (!msg) {
        showToast("Please type a message to send to the customer.", "error");
        return;
    }

    try {
        const res = await fetch("/api/official/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: selectedOfficialRequestId,
                message: msg,
                official_name: "Dr. Sarah Jenkins (Chief Governance & Executive Officer)"
            })
        });
        const data = await res.json();

        if (data.success) {
            input.value = "";
            showToast(`✅ Live reply sent to customer for ${selectedOfficialRequestId}!`, "success");
            reloadSelectedRequestThread();
        }
    } catch (err) {
        showToast("Error sending official reply: " + err.message, "error");
    }
}

async function markRequestCompleted() {
    if (!selectedOfficialRequestId) return;

    const input = document.getElementById("desk-response-input");
    const notes = input.value.trim() || "Resolved and verified by Higher Official.";

    try {
        const res = await fetch("/api/requests/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: selectedOfficialRequestId,
                resolution_notes: notes
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`✅ Request ${selectedOfficialRequestId} marked as Completed!`, "success");
            loadOfficialDashboard();
            loadCustomerRequests();
        }
    } catch (err) {
        showToast("Error completing request: " + err.message, "error");
    }
}

// -----------------------------------------------------------------------------
// Official Conversation Initiators: Group Chat Room & Live Call
// -----------------------------------------------------------------------------
let activeChatRoomId = null;
let activeChatRoomInterval = null;

async function initiateOfficialChatRoom() {
    if (!selectedOfficialRequestId) {
        showToast("Please select a request from the queue first.", "error");
        return;
    }
    const req = findRequestById(selectedOfficialRequestId);
    if (!req) return;

    try {
        const res = await fetch("/api/official/create-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: req.request_id,
                official_email: currentLoggedInOfficial ? currentLoggedInOfficial.email : "sarah.jenkins.executive@glasssupport.com",
                official_name: currentLoggedInOfficial ? currentLoggedInOfficial.name : "Dr. Sarah Jenkins"
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`💬 Live Chat Room (${data.room_id}) created! Email invitation sent to ${data.customer_email}.`, "success");
            loadOfficialDashboard();
            openRoomModal(data.room_id, currentLoggedInOfficial ? currentLoggedInOfficial.name : "Higher Official", req.user_name || req.user_email);
        }
    } catch (err) {
        showToast("Error creating chat room: " + err.message, "error");
    }
}

function getActiveRoomShareLink() {
    let roomId = activeChatRoomId;
    if (!roomId) {
        const req = findRequestById(selectedOfficialRequestId);
        if (req && req.chat_room_id) roomId = req.chat_room_id;
    }
    if (!roomId) {
        const bannerEl = document.getElementById("panel-active-room-id");
        if (bannerEl && bannerEl.innerText && bannerEl.innerText !== "ROOM-0000") {
            roomId = bannerEl.innerText;
        }
    }
    if (!roomId) return null;
    return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
}

function copyShareableChatLink() {
    const link = getActiveRoomShareLink();
    if (!link) {
        showToast("No active live chat room to share.", "error");
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            showToast(`📋 Live Chat Room link copied to clipboard!`, "success");
        }).catch(() => {
            prompt("Copy this Live Chat link to share with customer:", link);
        });
    } else {
        prompt("Copy this Live Chat link to share with customer:", link);
    }
}

function emailShareableChatLink() {
    const link = getActiveRoomShareLink();
    const req = findRequestById(selectedOfficialRequestId);
    const customerEmail = req ? req.user_email : "";
    const officialName = currentLoggedInOfficial ? currentLoggedInOfficial.name : "Higher Official";
    const subject = encodeURIComponent(`Live Chat Invitation: Support Inquiry ${req ? req.request_id : ''}`);
    const body = encodeURIComponent(`Hello,\n\nI have created a secure Live Chat Room for your inquiry. Please join our conversation directly using this link:\n\n${link}\n\nBest regards,\n${officialName}`);
    window.location.href = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
}

function openActiveChatRoomModal() {
    const req = findRequestById(selectedOfficialRequestId);
    if (!req || !req.chat_room_id) {
        showToast("No active chat room for this request yet.", "info");
        return;
    }
    openRoomModal(req.chat_room_id, req.assigned_official_name, req.user_name || req.user_email);
}

function openRoomModal(roomId, officialName, customerName) {
    activeChatRoomId = roomId;
    const offName = officialName || "Higher Official";
    const custName = customerName || "Customer";
    document.getElementById("room-header-id").innerText = roomId;
    document.getElementById("room-header-participants").innerText = `${offName} & ${custName}`;
    document.getElementById("room-badge-official").innerText = `👑 Higher Official: ${offName}`;
    document.getElementById("room-badge-customer").innerText = `🧑 Customer: ${custName}`;
    document.getElementById("group-chat-modal").classList.remove("hidden");

    reloadRoomMessages();
    if (activeChatRoomInterval) clearInterval(activeChatRoomInterval);
    activeChatRoomInterval = setInterval(reloadRoomMessages, 2500);
}

function closeGroupChatModal() {
    document.getElementById("group-chat-modal").classList.add("hidden");
    activeChatRoomId = null;
    if (activeChatRoomInterval) {
        clearInterval(activeChatRoomInterval);
        activeChatRoomInterval = null;
    }
}

async function reloadRoomMessages() {
    if (!activeChatRoomId) return;
    try {
        const res = await fetch(`/api/chat-room/${encodeURIComponent(activeChatRoomId)}`);
        const data = await res.json();
        const messages = data.messages || [];

        const stream = document.getElementById("group-room-messages");
        if (messages.length === 0) {
            stream.innerHTML = `<div style="text-align:center;padding:2rem;color:#94A3B8;font-size:0.85rem;">Room initialized. Send a message to start communicating.</div>`;
            return;
        }

        stream.innerHTML = messages.map(msg => {
            if (msg.sender_role === "system") {
                return `
                    <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:8px 12px;font-size:0.78rem;color:#3730A3;text-align:center;">
                        ${formatText(msg.content)}
                    </div>
                `;
            }
            const isOfficial = msg.sender_role === "official";
            if (isOfficial) {
                return `
                    <div style="display:flex;gap:10px;align-items:flex-start;">
                        <div style="width:32px;height:32px;border-radius:50%;background:#FEF3C7;border:1px solid #FCD34D;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;">👑</div>
                        <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;border-top-left-radius:2px;padding:9px 12px;max-width:80%;font-size:0.84rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size:0.72rem;font-weight:800;color:#0F172A;margin-bottom:2px;">${msg.sender_name} <span style="font-size:0.65rem;color:#64748B;">(${msg.sender_email})</span></div>
                            <div style="color:#1E293B;">${formatText(msg.content)}</div>
                            <div style="font-size:0.65rem;color:#94A3B8;margin-top:4px;">${msg.created_at || ''}</div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div style="display:flex;justify-content:flex-end;gap:10px;align-items:flex-start;">
                        <div style="background:#3730A3;color:#FFFFFF;border-radius:12px;border-top-right-radius:2px;padding:9px 12px;max-width:80%;font-size:0.84rem;">
                            <div style="font-size:0.72rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:2px;">${msg.sender_name} <span style="font-size:0.65rem;color:rgba(255,255,255,0.65);">(${msg.sender_email})</span></div>
                            <div>${formatText(msg.content)}</div>
                            <div style="font-size:0.65rem;color:rgba(255,255,255,0.7);text-align:right;margin-top:4px;">${msg.created_at || ''}</div>
                        </div>
                        <div style="width:32px;height:32px;border-radius:50%;background:#E2E8F0;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;">🧑</div>
                    </div>
                `;
            }
        }).join("");

        stream.scrollTop = stream.scrollHeight;
    } catch (err) {
        console.error("Error reloading room messages:", err);
    }
}

async function handleSendRoomMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById("group-room-input");
    const text = input.value.trim();
    if (!text || !activeChatRoomId) return;

    input.value = "";

    const isOfficialSender = !!currentLoggedInOfficial;
    const senderRole = isOfficialSender ? "official" : "customer";
    const senderName = isOfficialSender ? currentLoggedInOfficial.name : (activeUserEmail.split("@")[0].capitalize());
    const senderEmail = isOfficialSender ? currentLoggedInOfficial.email : activeUserEmail;

    try {
        const res = await fetch("/api/chat-room/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                room_id: activeChatRoomId,
                sender_role: senderRole,
                sender_name: senderName,
                sender_email: senderEmail,
                content: text
            })
        });
        const data = await res.json();
        if (data.success) {
            await reloadRoomMessages();
        }
    } catch (err) {
        showToast("Error sending room message: " + err.message, "error");
    }
}

// -----------------------------------------------------------------------------
// Live Call System
// -----------------------------------------------------------------------------
let callTimerInterval = null;
let callElapsedSeconds = 0;
let isCallMuted = false;
let isSpeakerActive = true;

async function initiateOfficialCall() {
    if (!selectedOfficialRequestId) {
        showToast("Please select a request from the queue first.", "error");
        return;
    }
    const req = findRequestById(selectedOfficialRequestId);
    if (!req) return;

    try {
        const res = await fetch("/api/official/start-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: req.request_id,
                official_email: currentLoggedInOfficial ? currentLoggedInOfficial.email : "sarah.jenkins.executive@glasssupport.com",
                official_name: currentLoggedInOfficial ? currentLoggedInOfficial.name : "Dr. Sarah Jenkins"
            })
        });
        const data = await res.json();

        // Open Call Modal
        document.getElementById("call-target-customer").innerText = req.user_name || req.user_email;
        document.getElementById("call-target-phone").innerText = req.user_phone || "+1 (415) 890-2134";
        document.getElementById("call-status-pill").innerText = "CALLING... (RINGING)";
        document.getElementById("call-status-pill").style.color = "#38BDF8";
        document.getElementById("call-status-pill").style.borderColor = "rgba(56, 189, 248, 0.4)";
        document.getElementById("call-timer-text").innerText = "00:00";
        document.getElementById("call-notes-input").value = "";
        document.getElementById("official-call-modal").classList.remove("hidden");

        callElapsedSeconds = 0;

        setTimeout(() => {
            const pill = document.getElementById("call-status-pill");
            if (pill) {
                pill.innerText = "CONNECTED (LIVE VOICE CHANNEL)";
                pill.style.color = "#34D399";
                pill.style.borderColor = "rgba(16, 185, 129, 0.4)";
            }
            startCallTimer();
        }, 2200);

    } catch (err) {
        showToast("Error starting call: " + err.message, "error");
    }
}

function startCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        callElapsedSeconds++;
        const mins = String(Math.floor(callElapsedSeconds / 60)).padStart(2, "0");
        const secs = String(callElapsedSeconds % 60).padStart(2, "0");
        document.getElementById("call-timer-text").innerText = `${mins}:${secs}`;
    }, 1000);
}

function toggleCallMute() {
    isCallMuted = !isCallMuted;
    const btn = document.getElementById("btn-call-mute");
    btn.classList.toggle("active", isCallMuted);
    btn.innerText = isCallMuted ? "🔇 Muted" : "🎤 Mute";
    showToast(isCallMuted ? "Microphone muted" : "Microphone active", "info");
}

function toggleCallSpeaker() {
    isSpeakerActive = !isSpeakerActive;
    const btn = document.getElementById("btn-call-speaker");
    btn.classList.toggle("active", !isSpeakerActive);
    btn.innerText = isSpeakerActive ? "🔊 Speaker" : "🔈 Earpiece";
    showToast(isSpeakerActive ? "Speaker output active" : "Handset output active", "info");
}

async function finishOfficialCall() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }

    const notes = document.getElementById("call-notes-input").value.trim();
    const duration = callElapsedSeconds;

    try {
        await fetch("/api/official/complete-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                request_id: selectedOfficialRequestId,
                duration_sec: duration,
                notes: notes,
                official_name: currentLoggedInOfficial ? currentLoggedInOfficial.name : "Dr. Sarah Jenkins"
            })
        });

        document.getElementById("official-call-modal").classList.add("hidden");
        showToast(`✅ Call session completed (${duration}s) and saved to case log!`, "success");
        loadOfficialDashboard();
        loadCustomerRequests();
    } catch (err) {
        document.getElementById("official-call-modal").classList.add("hidden");
        showToast("Call ended.", "info");
    }
}

function populateOfficialUserFilter() {
    const all = [...(allOfficialRequests.pending || []), ...(allOfficialRequests.completed || [])];
    const emails = [...new Set(all.map(r => r.user_email))];

    const select = document.getElementById("admin-user-filter");
    if (select) {
        select.innerHTML = '<option value="">Inspect User ▾</option>' +
            emails.map(e => `<option value="${e}">${e}</option>`).join("");
    }
}

function filterOfficialRequestsByUser(email) {
    if (!email) {
        renderOfficialQueue();
        return;
    }
    const filteredPending = (allOfficialRequests.pending || []).filter(r => r.user_email === email);
    const filteredCompleted = (allOfficialRequests.completed || []).filter(r => r.user_email === email);

    if (officialQueueTab === "pending") {
        renderCustomerRequestsGrid(filteredPending);
    } else {
        renderCustomerRequestsGrid(filteredCompleted);
    }
}

// -----------------------------------------------------------------------------
// VIEW 4: Service Reviews & CSAT Hub
// -----------------------------------------------------------------------------
let currentReviewRating = 5;
const ratingDescriptions = {
    1: "1 - Very Dissatisfied (Issue Persists)",
    2: "2 - Poor Assistance (Not Resolved)",
    3: "3 - Neutral (Average Response)",
    4: "4 - Good Assistance (Satisfied)",
    5: "5 - Excellent & Fast Assistance"
};

function setRating(val) {
    currentReviewRating = val;
    const stars = document.querySelectorAll(".star-item");
    stars.forEach((s, idx) => {
        if (idx < val) s.classList.add("active");
        else s.classList.remove("active");
    });
    document.getElementById("rating-desc-label").innerText = ratingDescriptions[val] || `${val} Stars`;

    if (val <= 2) {
        onResolutionToggle("Not Resolved");
    }
}

function onResolutionToggle(val) {
    document.querySelectorAll(".res-toggle-card").forEach(c => c.classList.remove("active"));
    const unresBox = document.getElementById("unresolved-details-box");

    if (val === "Fully Resolved") {
        document.getElementById("card-res-fully").classList.add("active");
        unresBox.classList.add("hidden");
    } else if (val === "Partially Resolved") {
        document.getElementById("card-res-partially").classList.add("active");
        unresBox.classList.remove("hidden");
    } else {
        document.getElementById("card-res-not").classList.add("active");
        unresBox.classList.remove("hidden");
    }
}

async function handleReviewSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const name = document.getElementById("rev-user-name").value.trim() || "Customer";
    const email = document.getElementById("rev-user-email").value.trim() || activeUserEmail;
    const issueCategory = document.getElementById("rev-issue-category").value;
    const resOption = document.querySelector('input[name="is_resolved_opt"]:checked').value;
    const feedback = document.getElementById("rev-feedback-comments").value.trim();
    const unresDetails = document.getElementById("rev-unresolved-text").value.trim();

    try {
        const res = await fetch("/api/reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_name: name,
                user_email: email,
                rating: currentReviewRating,
                issue_faced: issueCategory,
                is_resolved: resOption,
                service_feedback: feedback,
                unresolved_details: unresDetails
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, "success");
            document.getElementById("rev-feedback-comments").value = "";
            document.getElementById("rev-unresolved-text").value = "";
            loadCustomerReviews();
            loadOfficialDashboard();
            loadCustomerRequests();
        }
    } catch (err) {
        showToast("Error submitting review: " + err.message, "error");
    }
}

async function loadCustomerReviews() {
    try {
        const res = await fetch("/api/reviews");
        const data = await res.json();
        const reviews = data.reviews || [];

        const stream = document.getElementById("reviews-feed-stream");
        if (reviews.length === 0) {
            stream.innerHTML = `<div style="text-align:center;padding:2rem;color:#94A3B8;">No customer reviews submitted yet.</div>`;
            return;
        }

        stream.innerHTML = reviews.map(r => {
            const starsStr = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            const statusClass = r.is_resolved === "Fully Resolved" ? "resolved" : "unresolved";
            const unresNote = r.unresolved_details ? `<div class="rev-unresolved-note">⚠️ <b>Unresolved Note:</b> ${r.unresolved_details}</div>` : "";

            return `
                <div class="review-item-card">
                    <div class="rev-item-top">
                        <span class="rev-item-author">${r.user_name} (${r.user_email})</span>
                        <span class="rev-item-stars">${starsStr}</span>
                    </div>
                    <div class="rev-meta-tags-row">
                        <span class="rev-issue-tag">${r.issue_faced}</span>
                        <span class="rev-status-pill ${statusClass}">${r.is_resolved}</span>
                    </div>
                    <div class="rev-comment-text">${r.service_feedback || 'No written comments.'}</div>
                    ${unresNote}
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Error loading reviews:", err);
    }
}

// -----------------------------------------------------------------------------
// OTP Handlers & Notifications
// -----------------------------------------------------------------------------
function openOTPModal(email) {
    document.getElementById("otp-email-label").innerText = email;
    document.getElementById("otp-input-field").value = "";
    document.getElementById("otp-modal").classList.remove("hidden");
}

function closeOTPModal() {
    document.getElementById("otp-modal").classList.add("hidden");
}

async function submitOTPVerification() {
    const otp = document.getElementById("otp-input-field").value.trim();
    if (!otp) {
        showToast("Please enter the verification code.", "error");
        return;
    }
    try {
        const res = await fetch("/api/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: activeUserEmail, otp: otp })
        });
        const data = await res.json();
        closeOTPModal();
        showToast("Identity Verified Successfully!", "success");
        
        const stream = document.getElementById("chat-stream");
        stream.insertAdjacentHTML("beforeend", `
            <div class="msg-bot-group">
                <div class="bot-icon-circle">🛡️</div>
                <div class="bot-card-content">
                    <div class="bot-card-header"><span class="bot-title">GlassSupport Security</span><span class="badge-high-match-green">VERIFIED IDENTITY</span></div>
                    <div class="bot-card-body">
                        <p><b>Account Ledger Statement for ${activeUserEmail}:</b><br>
                        • Available Balance: <b>$14,850.00 USD</b><br>
                        • Status: <b>Active / Unfrozen</b><br>
                        • Recent Activity: ACH Credit #99281 Settled</p>
                    </div>
                </div>
            </div>
        `);
    } catch (err) {
        showToast("Invalid code. Enter 123456 to test.", "error");
    }
}

function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.classList.remove("hidden");
    setTimeout(() => { toast.classList.add("hidden"); }, 3500);
}
