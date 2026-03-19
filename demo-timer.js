const DEMO_DURATION_MS = 10 * 60 * 1000;
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

function resetDemo() {
    localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
    localStorage.setItem(STORAGE_KEY_DATE, getTodayDateString());
}

function initDemo() {
    if (isNewDay()) {
        resetDemo();
    }
}

let isPaused = false;
let pauseStartTime = null;
let accumulatedPauseTime = 0;

function resetDemoTimer() {
    accumulatedPauseTime = 0;
    pauseStartTime = null;
    localStorage.setItem(STORAGE_KEY_START, Date.now().toString());
    localStorage.removeItem('demoPauseState');
    isPaused = false;
    updateTimerContent();
}

function loadPauseState() {
    const saved = localStorage.getItem('demoPauseState');
    if (saved) {
        const state = JSON.parse(saved);
        isPaused = state.isPaused;
        pauseStartTime = state.pauseStartTime;
        accumulatedPauseTime = state.accumulatedPauseTime;
    }
}

function getRemainingTime() {
    initDemo();
    loadPauseState();
    const startTime = parseInt(localStorage.getItem(STORAGE_KEY_START)) || Date.now();
    let elapsed = Date.now() - startTime - accumulatedPauseTime;
    const remaining = DEMO_DURATION_MS - elapsed;
    return Math.max(0, remaining);
}

function loadPauseState() {
    const saved = localStorage.getItem('demoPauseState');
    if (saved) {
        const state = JSON.parse(saved);
        isPaused = state.isPaused;
        pauseStartTime = state.pauseStartTime;
        accumulatedPauseTime = state.accumulatedPauseTime;
    }
}

function getRemainingTime() {
    initDemo();
    loadPauseState();
    const startTime = parseInt(localStorage.getItem(STORAGE_KEY_START)) || Date.now();
    let elapsed = Date.now() - startTime;
    if (isPaused && pauseStartTime) {
        elapsed = pauseStartTime - startTime - accumulatedPauseTime;
    } else {
        elapsed = Date.now() - startTime - accumulatedPauseTime;
    }
    const remaining = DEMO_DURATION_MS - elapsed;
    return Math.max(0, remaining);
}

function isDemoExpired() {
    if (isPaused) return false;
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
        <a href="http://simonallmer.com/sevenwondersarcade" style="
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
            <a href="http://simonallmer.com/sevenwondersarcade" style="
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
            <a href="http://simonallmer.com/sevenwondersarcade" style="color: #C5A059; margin-left: 8px; text-decoration: none;" onclick="event.stopPropagation()">Subscribe</a>
        `;
    } else {
        const display = `<span id="permanent-timer-display" style="color: ${isLow ? '#ff6b6b' : '#C5A059'}; display: inline-block; min-width: 45px;">${formatTime(remaining)}</span>`;
        timer.innerHTML = `
            <span style="color: rgba(227, 218, 201, 0.6); display: inline-block; min-width: 50px;">DEMO</span>
            ${display}
        `;
    }
}

function handleTimerClick() {
    showSubscriptionPopup();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        if (getRemainingTime() > 0) {
            resetDemoTimer();
        }
    }
});

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
                <a href="http://simonallmer.com/sevenwondersarcade" style="color: #C5A059; text-decoration: underline;">
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
            <a href="http://simonallmer.com/sevenwondersarcade" style="font-family: 'Cinzel', serif; font-size: 0.75rem; color: #C5A059; text-decoration: underline;">Subscribe</a>
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

initDemo();

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        addPermanentTimer();
        if (!checkAndShowOverlay()) {
            startExpirationChecker();
        }
    });
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        addPermanentTimer();
        checkAndShowOverlay();
    }, 100);
}
