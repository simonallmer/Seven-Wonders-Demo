const DEMO_DURATION_MS = 5 * 60 * 1000;
const STORAGE_KEY_START = 'demoStartTime';
const STORAGE_KEY_DATE = 'demoDate';

function getStoredDate() {
    return localStorage.getItem(STORAGE_KEY_DATE);
}

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isNewDay() {
    const storedDate = getStoredDate();
    const today = getTodayDateString();
    return storedDate !== today;
}

const STORAGE_KEY_PAUSE = 'demoPauseState';

let isPaused = false;
let pauseStartTime = null;
let accumulatedPauseTime = 0;

function resetDemo() {
    localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
    localStorage.setItem(STORAGE_KEY_DATE, getTodayDateString());
    clearPauseState();
}

function initDemo() {
    if (isNewDay()) {
        resetDemo();
    }
}

function clearPauseState() {
    isPaused = false;
    pauseStartTime = null;
    accumulatedPauseTime = 0;
    localStorage.removeItem(STORAGE_KEY_PAUSE);
}

function loadPauseState() {
    const saved = localStorage.getItem(STORAGE_KEY_PAUSE);
    if (!saved) return;
    try {
        const state = JSON.parse(saved);
        isPaused = !!state.isPaused;
        pauseStartTime = state.pauseStartTime || null;
        accumulatedPauseTime = state.accumulatedPauseTime || 0;
    } catch (e) {
        clearPauseState();
    }
}

function savePauseState() {
    localStorage.setItem(STORAGE_KEY_PAUSE, JSON.stringify({
        isPaused,
        pauseStartTime,
        accumulatedPauseTime
    }));
}

// The clock only advances during active play. Menus, the rules panel, a
// hidden tab and a player who has walked away all freeze it; that time is
// banked in accumulatedPauseTime so the demo picks up where it left off.
function pauseDemoTimer() {
    loadPauseState();
    if (isPaused) return;
    isPaused = true;
    pauseStartTime = Date.now();
    savePauseState();
    updateTimerContent();
}

function resumeDemoTimer() {
    loadPauseState();
    if (!isPaused) return;
    if (pauseStartTime) {
        accumulatedPauseTime += Date.now() - pauseStartTime;
    }
    isPaused = false;
    pauseStartTime = null;
    savePauseState();
    updateTimerContent();
}

function resetDemoTimer() {
    localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
    clearPauseState();
    updateTimerContent();
}

function getRemainingTime() {
    initDemo();
    loadPauseState();
    const startTime = parseInt(localStorage.getItem(STORAGE_KEY_START)) || Date.now();
    const countUpTo = (isPaused && pauseStartTime) ? pauseStartTime : Date.now();
    const elapsed = countUpTo - startTime - accumulatedPauseTime;
    return Math.max(0, DEMO_DURATION_MS - elapsed);
}

function isDemoExpired() {
    return getRemainingTime() <= 0;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function checkDemoAccess() {
    if (isDemoExpired()) {
        return false;
    }
    return true;
}

function showExpiredOverlay(container) {
    const overlay = document.createElement('div');
    overlay.id = 'demo-expired-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(13, 11, 9, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        color: #E3DAC9;
        font-family: 'Cinzel', serif;
        text-align: center;
        padding: 20px;
    `;
    overlay.innerHTML = `
        <p style="font-size: 1.2rem; letter-spacing: 0.1em; margin-bottom: 30px; opacity: 0.7;">Your daily demo time has ended.</p>
        <p style="font-size: 1rem; margin-bottom: 40px; max-width: 400px; line-height: 1.8;">Continue playing and unlock all features with an Arcade Subscription.</p>
        <a href="https://simonallmer.com/arcade" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="
            display: inline-block;
            padding: 14px 40px;
            font-family: 'Cinzel', serif;
            font-size: 1rem;
            font-weight: 700;
            color: #0d0b09;
            background: #C5A059;
            border: none;
            cursor: pointer;
            text-decoration: none;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            transition: all 0.3s ease;
        ">Subscribe</a>
    `;
    document.body.appendChild(overlay);
}

function showSubscriptionPopup() {
    if (document.getElementById('subscription-popup')) return;
    
    const popup = document.createElement('div');
    popup.id = 'subscription-popup';
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(13, 11, 9, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-family: 'Cinzel', serif;
    `;
    
    popup.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1612 0%, #110f0d 100%); border: 1px solid rgba(197, 160, 89, 0.4); border-radius: 8px; padding: 40px; max-width: 450px; text-align: center; color: #E3DAC9;">
            <h2 style="color: #C5A059; font-size: 1.4rem; letter-spacing: 0.15em; margin-bottom: 25px;">ARCADE SUBSCRIPTION</h2>
            <p style="line-height: 1.8; font-size: 1rem; margin-bottom: 30px;">Access Unlimited Play with an Arcade Subscription.</p>
            <a href="https://simonallmer.com/aboutarcade" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="
                display: inline-block;
                padding: 14px 40px;
                font-size: 1rem;
                font-weight: 700;
                color: #0d0b09;
                background: #C5A059;
                border: none;
                cursor: pointer;
                text-decoration: none;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                transition: all 0.3s ease;
                border-radius: 4px;
            ">Learn More</a>
            <button onclick="document.getElementById('subscription-popup').remove()" style="
                display: block;
                margin: 20px auto 0;
                background: none;
                border: none;
                color: rgba(227, 218, 201, 0.5);
                font-family: 'Cinzel', serif;
                font-size: 0.8rem;
                cursor: pointer;
                letter-spacing: 0.1em;
            ">Close</button>
        </div>
    `;
    
    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });
    
    document.body.appendChild(popup);
}

function addPermanentTimer() {
    if (document.getElementById('permanent-demo-timer')) return;
    
    const timer = document.createElement('div');
    timer.id = 'permanent-demo-timer';
    timer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        padding: 8px 16px;
        background: rgba(26, 21, 16, 0.9);
        border: 1px solid rgba(197, 160, 89, 0.4);
        border-radius: 6px;
        font-family: 'Cinzel', serif;
        font-size: 0.75rem;
        color: rgba(227, 218, 201, 0.8);
        z-index: 9999;
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: border-color 0.3s ease;
    `;
    timer.title = 'Click for subscription info';
    
    updateTimerContent(timer);
    document.body.appendChild(timer);
    
    timer.addEventListener('click', handleTimerClick);
    
    setInterval(() => updateTimerContent(timer), 1000);
}

function updateTimerContent(timer) {
    if (!timer) timer = document.getElementById('permanent-demo-timer');
    if (!timer) return;
    
    const remaining = getRemainingTime();
    const isLow = remaining > 0 && remaining <= 60000;
    const isExpired = isDemoExpired();
    
    if (isExpired) {
        timer.innerHTML = `
            <span style="color: rgba(227, 218, 201, 0.5); display: inline-block; width: 70px;">DEMO ENDED</span>
            <span style="margin-left: 8px; color: rgba(197, 160, 89, 0.6);">|</span>
            <a href="https://simonallmer.com/arcade" target="_blank" rel="noopener noreferrer" style="color: #C5A059; margin-left: 8px; text-decoration: none;" onclick="event.stopPropagation()">Subscribe</a>
        `;
    } else {
        const timeColor = isPaused ? 'rgba(197, 160, 89, 0.45)' : (isLow ? '#ff6b6b' : '#C5A059');
        const display = `<span id="permanent-timer-display" style="color: ${timeColor}; display: inline-block; min-width: 45px;">${formatTime(remaining)}</span>`;
        const label = isPaused ? 'PAUSED' : 'DEMO';
        timer.innerHTML = `
            <span style="color: rgba(227, 218, 201, 0.6); display: inline-block; min-width: 50px;">${label}</span>
            ${display}
        `;
    }
}

function handleTimerClick() {
    showSubscriptionPopup();
}

function showMenuDemoStatus() {
    const header = document.querySelector('.main-header');
    if (!header) return;
    
    const existingStatus = document.getElementById('demo-status');
    if (existingStatus) existingStatus.remove();
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'demo-status';
    
    if (isDemoExpired()) {
        statusDiv.innerHTML = `
            <p style="font-size: 0.75rem; letter-spacing: 0.08em; color: rgba(227, 218, 201, 0.6); margin-bottom: 10px;">
                DEMO TIME EXPIRED
            </p>
            <p style="font-size: 0.8rem; margin-bottom: 15px;">
                <a href="https://simonallmer.com/arcade" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color: #C5A059; text-decoration: underline;">
                    Subscribe
                </a> to unlock all features.
            </p>
        `;
    } else {
        const remaining = getRemainingTime();
        statusDiv.innerHTML = `
            <p style="font-size: 0.75rem; letter-spacing: 0.08em; color: rgba(227, 218, 201, 0.6); margin-bottom: 8px;">
                FREE DEMO VERSION
            </p>
            <p style="font-size: 0.85rem; color: #C5A059;">
                Time Remaining: <span id="demo-timer-display">${formatTime(remaining)}</span>
            </p>
        `;
    }
    
    header.appendChild(statusDiv);
    
    if (!isDemoExpired()) {
        const timerDisplay = document.getElementById('demo-timer-display');
        if (timerDisplay) {
            setInterval(() => {
                const remaining = getRemainingTime();
                timerDisplay.textContent = formatTime(remaining);
                if (remaining <= 0) {
                    showMenuDemoStatus();
                }
            }, 1000);
        }
    }
}

function addGameMenuTimer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const existingTimer = document.getElementById('game-menu-timer');
    if (existingTimer) existingTimer.remove();
    
    const timerDiv = document.createElement('div');
    timerDiv.id = 'game-menu-timer';
    timerDiv.style.cssText = `
        text-align: center;
        padding: 10px 15px;
        background: rgba(197, 160, 89, 0.1);
        border: 1px solid rgba(197, 160, 89, 0.3);
        border-radius: 6px;
        margin-bottom: 10px;
    `;
    
    updateGameMenuTimer(timerDiv);
    container.insertBefore(timerDiv, container.firstChild);
    
    if (!isDemoExpired()) {
        setInterval(() => {
            const display = document.getElementById('game-menu-timer-display');
            if (display) {
                const remaining = getRemainingTime();
                display.textContent = formatTime(remaining);
                if (remaining <= 0) {
                    addGameMenuTimer(containerId);
                    showExpiredOverlay(document.body);
                }
            }
        }, 1000);
    }
}

function updateGameMenuTimer(timerDiv) {
    if (!timerDiv) timerDiv = document.getElementById('game-menu-timer');
    if (!timerDiv) return;
    
    const remaining = getRemainingTime();
    const isExpired = isDemoExpired();
    
    if (isExpired) {
        timerDiv.innerHTML = `
            <div style="font-family: 'Cinzel', serif; font-size: 0.7rem; letter-spacing: 0.1em; color: rgba(227, 218, 201, 0.5); margin-bottom: 8px;">DEMO ENDED</div>
            <a href="https://simonallmer.com/arcade" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-family: 'Cinzel', serif; font-size: 0.75rem; color: #C5A059; text-decoration: underline;">Subscribe</a>
        `;
    } else {
        timerDiv.innerHTML = `
            <div style="font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(227, 218, 201, 0.6); margin-bottom: 4px;">DEMO TIME</div>
            <div style="font-family: 'Cinzel', serif; font-size: 1rem; color: #C5A059;" id="game-menu-timer-display">${formatTime(getRemainingTime())}</div>
        `;
    }
}

function checkAndShowOverlay() {
    if (isDemoExpired()) {
        showExpiredOverlay(document.body);
        return true;
    }
    return false;
}

function startExpirationChecker() {
    const checkInterval = setInterval(() => {
        if (isDemoExpired()) {
            clearInterval(checkInterval);
            showExpiredOverlay(document.body);
        }
    }, 1000);
}

// ============================================
// ACTIVE PLAY DETECTION
// ============================================

const DEMO_IDLE_PAUSE_MS = 90 * 1000;

// Menu pages, where the clock never runs.
const DEMO_MENU_PAGES = ['', '/', 'index.html'];

// Anything that covers the board means the player is reading, not playing.
const DEMO_PAUSING_SELECTORS = [
    '.side-menu.open',
    '#rules-modal',
    '#rules-overlay',
    '.rules-modal',
    '#game-over-overlay',
    '.game-over-overlay',
    '#game-over-modal',
    '#modal-overlay',
    '#subscription-popup'
];

let demoLastActivityAt = Date.now();

function demoIsMenuPage() {
    const page = window.location.pathname.split('/').pop();
    return DEMO_MENU_PAGES.includes(page);
}

function demoIsElementVisible(el) {
    if (!el) return false;
    if (el.classList.contains('hidden')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
    return el.getClientRects().length > 0;
}

function demoIsInterfaceBlocking() {
    return DEMO_PAUSING_SELECTORS.some(selector =>
        Array.from(document.querySelectorAll(selector)).some(demoIsElementVisible)
    );
}

function demoShouldTimerRun() {
    if (document.hidden) return false;
    if (demoIsMenuPage()) return false;
    if (demoIsInterfaceBlocking()) return false;
    return Date.now() - demoLastActivityAt <= DEMO_IDLE_PAUSE_MS;
}

function syncDemoTimerState() {
    if (demoShouldTimerRun()) {
        resumeDemoTimer();
    } else {
        pauseDemoTimer();
    }
}

function demoMarkActivity() {
    demoLastActivityAt = Date.now();
}

function startActivityTracking() {
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(eventName => {
        document.addEventListener(eventName, demoMarkActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', syncDemoTimerState);
    window.addEventListener('pagehide', pauseDemoTimer);
    setInterval(syncDemoTimerState, 500);
    syncDemoTimerState();
}

initDemo();

let demoTimerStarted = false;

function startDemoTimer() {
    if (demoTimerStarted) return;
    demoTimerStarted = true;
    addPermanentTimer();
    startActivityTracking();
    if (!checkAndShowOverlay()) {
        startExpirationChecker();
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', startDemoTimer);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startDemoTimer, 100);
}
