#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Validate new Neon Farm backend features: referral system, in-app notifications, IP tracking + IP/user ban flow, plus regression on login/register/me, deposits, withdrawals, PIX settings."

backend:
  - task: "Referral system (register with referral_code, /me/referrals, bonus on first approved deposit)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "All referral flows verified end-to-end. POST /auth/register without code returns referral_code in user. Register with valid code links the referral (GET /me/referrals shows total_referrals=1, paid_referrals=0). Register with referral_code='INVALID999' returns 400 'Código de indicação inválido'. Schema of /me/referrals matches spec (code, bonus_pct=10, bonus_cap=50, total_referrals, paid_referrals, total_earned, referrals[]). When admin approves user B's first deposit (R$200), user A's balance increased by exactly R$20 (10% of 200, under R$50 cap) — capping logic correct. A also got a kind='referral' notification and B got a kind='deposit' notification. paid_referrals → 1 and total_earned → 20.0 after approval."

  - task: "Notifications endpoints (list, unread-count, read, read-all) and notifications fired on deposit/withdrawal admin actions"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /me/notifications returns { items: [...], unread: N }. GET /me/notifications/unread-count returns { unread: N }. POST /me/notifications/{id}/read marks one read; POST /me/notifications/read-all sets all to read (unread-count becomes 0 afterwards). Notifications are created on: deposit approve (kind='deposit'), deposit reject (kind='deposit'), withdrawal approve (kind='withdraw'), referral bonus paid (kind='referral'), and on new pending referral signup (kind='referral')."

  - task: "IP tracking + geolocation snapshot on register/login (admin/users + admin/users/{id}/ips)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /api/admin/users returns last_ip, last_ip_city, last_ip_country, last_ip_country_code, last_ip_isp, last_login_at on each user. In the public preview environment the detected IP is a real public IP (34.170.12.145 / Google LLC / Council Bluffs, US) — geolocation worked. GET /api/admin/users/{user_id}/ips returns { user: {...}, logs: [{ip, action, city, country, banned, created_at, ...}] } as specified, with 'banned' flag correctly computed against banned_ips collection."

  - task: "IP ban / unban flow (ban user, login blocked, /admin/banned-ips, DELETE banned-ips/{ip}, unban user removes IPs)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "POST /admin/users/{id}/ban with { reason: 'test' } returns { ok: true, banned_ips: [...], ip_count: N } and sets user's banned=true. Subsequent POST /auth/login for that user returns 403 'Conta bloqueada. Contate o suporte.' GET /admin/banned-ips returns list (admin-only, 403 for normal user). DELETE /admin/banned-ips/{ip} returns 200 and removes the IP. POST /admin/users/{id}/unban returns { ok: true, ips_unbanned: N } and lifts user-level ban — banned user could log in again afterwards. Non-admin access to /admin/banned-ips and /admin/users returns 403 as expected. No 500 errors observed."

  - task: "Regression: login/register/me, deposit create+approve+reject, withdrawal create (with withdraw_password) + approve, PIX settings"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "Admin login (ggc@gmail.com) succeeds and GET /auth/me returns admin user. GET /api/settings/pix returns full schema (display_key, display_key_type, pix_key, pix_key_type, company_name, beneficiary_city, payload). Deposit creation works; admin approve credits user balance and pushes deposit notification; admin reject pushes deposit notification. Withdrawal creation without prior /me/withdraw-password returns 400 'Defina sua senha de saque antes de continuar.' Setting withdraw password (POST /me/withdraw-password) works; subsequent withdrawal with the correct password succeeds; admin approve fires a kind='withdraw' notification."

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "testing"
      message: "Executed full backend test suite (/app/backend_test.py) against the public preview URL. 48/49 assertions passed; the single 'fail' was an incorrect assertion in my own test (I asserted total_earned >= R$50 but with a R$200 deposit the correct 10% bonus is R$20, well under the R$50 cap — the system computed it correctly, my expectation was wrong). All referral, notification, IP tracking, ban/unban and regression flows behave per spec. Note: the worker pod observes real public IPs (Google LLC), so banned_ips was populated and DELETE/list endpoints were fully exercised — not a private-IP edge case in this run. No 500 errors. No schema mismatches."
    - agent: "testing"
      message: "Round 2 — validated 5 new admin endpoints via /app/admin_new_endpoints_test.py. 19/20 PASS. (1) GET /api/admin/stats: all 14 expected keys returned (total_users/total_lotes/total_deposits/pending_deposits/approved_deposits/total_withdrawals/pending_withdrawals/total_transactions/total_notifications/total_referrals/total_banned_ips/total_balance/sum_approved_deposits/sum_approved_withdrawals); non-admin gets 403. (2) POST /api/admin/lotes accepts duration_days=1,7,60,90,365 (no longer stuck at 30); rejects 0 and 400 with 422. (3) DELETE /api/admin/lotes/{id} actually removes the lote (second DELETE returns 404 confirming deletion). (4) POST /api/admin/reset: non-admin->403; wrong confirm->400 with 'Confirmação inválida'; valid {confirm:'RESET', keep_lotes:true}->200 with deleted dict containing exactly users/deposits/withdrawals/transactions/purchases/notifications/referrals/user_ip_logs/banned_ips (no 'lotes' key when keep_lotes=true). Admin login still works after reset; GET /admin/stats now shows total_users=0, total_deposits=0, total_withdrawals=0, total_transactions=0, total_notifications=0, total_referrals=0, total_banned_ips=0, and total_lotes preserved (4→4). (5) POST /api/admin/generate-image: non-admin->403; empty prompt->422 (validation works). HOWEVER the actual image generation with prompt='PC Gamer' returned 500 because the EMERGENT_LLM_KEY budget is exhausted: 'litellm.BadRequestError: Budget has been exceeded! Current cost: 0.0678255, Max budget: 0.001'. This is NOT a code defect — auth, admin-gate, prompt validation, model wiring (gemini-3.1-flash-image-preview with modalities=['image','text']) and response shape handling (data:{mime};base64,{data}) are all correctly implemented. Main agent should top up / replace the EMERGENT_LLM_KEY to verify the happy-path image return."
