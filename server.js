// A. Selectors (Kept for external referencing clarity)
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s), $status = $('#status'), $cells = $$('.cell'), $line = $('#winning-line'), $mBtn = $('#mode-toggle-button'), $sBtn = $('#settings-button'), $menu = $('#settings-menu'), $oBtn = $('#close-menu-button'), $overlay = $('#menu-overlay'), $sYr = $('#score-your-sign'), $sMt = $('#score-mate-sign'), $tYr = $('#top-score-your-sign'), $tMt = $('#top-score-mate-sign'), $rBtn = $('#reset-score-button'), $cYr = $('#color-btn-your-sign'), $cMt = $('#color-btn-mate-sign'), $cMod = $('#custom-color-modal'), $pLbl = $('#picker-player-label'), $cPrev = $('#color-preview'), $hSl = $('#hue-slider'), $sSl = $('#sat-slider'), $aSl = $('#alpha-slider'), $cIn = $('#color-input-box'), $sBtnS = $('#save-color-btn'), $tBtn = $('#type-select-btn'), $tMenu = $('#type-menu'), $tDisp = $('#color-type-display'), $sSel = $('#select-sign-button'), $sMod = $('#sign-selector-modal'), $sCl = $('#close-sign-selector-btn'), $sBtns = $$('.sign-option-btn'), $lMod = $('#online-lobby-modal'), $lStat = $('#lobby-status-message'), $cRBtn = $('#create-room-btn'), $rDSp = $('#room-display-section'), $rCDisp = $('#room-code-display'), $cCBtn = $('#copy-code-btn'), $jRIn = $('#join-room-input'), $jRBtn = $('#join-room-btn'), $cLBtn = $('#cancel-lobby-btn');

// B. State & Constants
let gameOn = true, sX = 0, sO = 0, isOnline = false, cP = "X", gS = Array(9).fill(""), cX = "rgba(255, 71, 71, 1)", cO = "rgba(189, 189, 189, 1)", activeP = null, cF = "HEX", ySign = "X", currentRoomID = null; 
const P_X = "X", P_O = "O", N_X = "Your", N_O = "Mate's", CLS_X = "P1", CLS_O = "P2", B_SZ = 300, D_LEN = 424.26, R_DLY = 1610, W_C = [ [0,1,2,'R',1,0], [3,4,5,'R',2,0], [6,7,8,'R',3,0], [0,3,6,'C',1,90], [1,4,7,'C',2,90], [2,5,8,'C',3,90], [0,4,8,'D',1,45], [2,4,6,'D',2,135] ];
let isHost = false, isMyTurn = true; // isMyTurn will be controlled by WebSocket in online mode
let ws = null; // WebSocket object

// FINAL SERVER ADDRESS: 106.196.109.141
const SERVER_URL = 'ws://106.196.109.141:8080'; 

// C. Status & Score Functions
const gPN = m => {
    if (isOnline) {
        // In online mode, the host (isHost=true) is always Player X's sign
        // The joiner (isHost=false) is always Player O's sign
        const myPlayer = isHost ? P_X : P_O;
        return m === myPlayer ? "Your" : "Mate's";
    } else {
        return m === P_X ? "Your" : "Mate's";
    }
};
const gWN = m => {
    if (!isOnline) return m === P_X ? "You" : "Mate";
    const myPlayer = isHost ? P_X : P_O;
    return m === myPlayer ? "You" : "Mate";
};
const wMsg = () => `${gWN(cP)} has won! 🎉 (Restarting...)`;
const cPT = () => {
    if (!gameOn) return $status.innerHTML;
    if (isOnline) {
        // Show status based on whether it is my turn or opponent's turn
        return isMyTurn ? `It's Your Turn!` : `Waiting for Mate...`;
    }
    // Offline status
    return `It's ${gPN(cP)} Turn!`;
};
const uScore = () => {$sYr.textContent = sX; $sMt.textContent = sO; $tYr.textContent = `You: ${sX}`; $tMt.textContent = `Mate: ${sO}`;};

// D. Color Utilities (Omitted for compression, logic unchanged)
const hToR = (h, s, l) => {
    s /= 100; l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) {r = c; g = x;} else if (60 <= h && h < 120) {r = x; g = c;} else if (120 <= h && h < 180) {g = c; b = x;} else if (180 <= h && h < 240) {g = x; b = c;} else if (240 <= h && h < 300) {r = x; b = c;} else if (300 <= h && h < 360) {r = c; b = x;}
    r = Math.round((r + m) * 255); g = Math.round((g + m) * 255); b = Math.round((b + m) * 255);
    return [r, g, b];
};
const rToH = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0, s = 0, l = 0;
    if (delta == 0) h = 0; else if (cmax == r) h = ((g - b) / delta) % 6; else if (cmax == g) h = (b - r) / delta + 2; else h = (r - g) / delta + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
    l = (cmax + cmin) / 2; s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(0); l = +(l * 100).toFixed(0);
    return [h, s, l];
};
const pColor = c => {
    c = c.trim().toLowerCase(); let r, g, b, a = 1, h, s, l, hex;
    const toHex = c => Math.round(c).toString(16).padStart(2, '0');
    if (c.startsWith('#')) {
        let m = c.match(/^#?([a-f\d]{6})$/i);
        if (m) { hex = '#' + m[1]; r = parseInt(m[1].substring(0, 2), 16); g = parseInt(m[1].substring(2, 4), 16); b = parseInt(m[1].substring(4, 6), 16); }
    } else if (c.startsWith('rgb')) {
        let m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)$/);
        if (m) { r = +m[1]; g = +m[2]; b = +m[3]; a = m[4] !== undefined ? +m[4] : 1; if (r > 255 || g > 255 || b > 255) return null; }
    } else if (c.startsWith('hsl')) {
        let m = c.match(/^hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d\.]+))?\)$/);
        if (m) { h = +m[1]; s = +m[2]; l = +m[3]; a = m[4] !== undefined ? +m[4] : 1; [r, g, b] = hToR(h, s, l); }
    }
    if (r !== undefined) {
        if (h === undefined) { [h, s, l] = rToH(r, g, b); }
        if (hex === undefined) { hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`; }
        return { r, g, b, a: Math.min(1, Math.max(0, a)), h, s, l, hex };
    }
    return null;
};
const cToF = (c, f) => {
    const { r, g, b, a, h, s, l, hex } = c;
    switch (f) {
        case 'HEX': return hex;
        case 'RGBA': return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
        case 'HSLA': return `hsla(${h}, ${s}%, ${l}%, ${a.toFixed(2)})`;
        case 'HSVA': return `hsla(${h}, ${s}%, ${l}%, ${a.toFixed(2)})`; 
        default: return hex;
    }
};

// E. Core Game Logic
const aCols = () => {
    $$(`.${CLS_X}`).forEach(c => c.style.color = cX);
    $$(`.${CLS_O}`).forEach(c => c.style.color = cO);
    document.documentElement.style.setProperty('--playerX-color', cX);
    document.documentElement.style.setProperty('--playerO-color', cO);
    $cYr.style.backgroundColor = cX;
    $cMt.style.backgroundColor = cO;
};
const gDM = m => m === P_X ? ySign : (ySign === P_X ? P_O : P_X);
const hCPly = (c, i) => {
    gS[i] = cP; 
    c.innerHTML = gDM(cP);
    c.classList.add(cP === P_X ? CLS_X : CLS_O); 
    c.style.color = cP === P_X ? cX : cO;
};
const hCCh = () => {
    cP = cP === P_X ? P_O : P_X; 
    if (isOnline) {
        isMyTurn = cP === (isHost ? P_X : P_O);
    }
    $status.innerHTML = cPT();
};
const pWL = w => {
    const [, , , type, axis, rot] = w;
    const c = cP === P_X ? cX : cO;
    $line.style.backgroundColor = c; 
    $line.style.opacity = '1'; 
    $line.style.transform = `none`; 
    $line.style.transformOrigin = `0 50%`; 
    $line.style.left = `0`; 
    $line.style.top = `0`;
    let len;
    if (type === 'R') {
        len = B_SZ; $line.style.top = `${(axis * 100) - 50}px`; $line.style.transform = `translateY(-50%)`; 
    } else if (type === 'C') {
        len = B_SZ; $line.style.left = `${(axis * 100) - 50}px`; $line.style.transform = `translateY(-50%) rotate(90deg)`; 
    } else if (type === 'D') {
        len = D_LEN;
        if (axis === 1) { $line.style.transform = `translateY(-50%) rotate(45deg)`; } 
        else { $line.style.left = `${B_SZ}px`; $line.style.transform = `translateY(-50%) rotate(135deg)`; }
    }
    $line.style.width = `${len}px`;
};
const hRV = () => {
    let rW = false, wLC = null; 
    for (const w of W_C) {
        let [a, b, c] = [gS[w[0]], gS[w[1]], gS[w[2]]];
        if (a === '' || a !== b || a !== c) continue;
        rW = true; wLC = w; break;
    }
    if (rW) {
        // WIN
        $status.innerHTML = wMsg(); 
        $status.classList.remove('draw-flash'); 
        gameOn = false; pWL(wLC);
        cP === P_X ? sX++ : sO++; uScore();
        setTimeout(hRst, R_DLY);
        // If online, tell server to reset
        if (isOnline) sendData({ type: 'reset' });
        return;
    }
    if (!gS.includes("")) {
        // DRAW
        $status.innerHTML = "DRAW!"; 
        $status.classList.add('draw-flash'); 
        $line.style.opacity = '0'; 
        gameOn = false;
        setTimeout(hRst, R_DLY);
        // If online, tell server to reset
        if (isOnline) sendData({ type: 'reset' });
        return;
    }
    // Switch turn
    hCCh(); 
};
const hCC = e => {
    if (!gameOn) return;
    const c = e.target;
    const i = +c.dataset.cellIndex;
    if (gS[i] !== "") return;

    if (isOnline) {
        if (!isMyTurn) {
            $status.innerHTML = "Not Your Turn!";
            setTimeout(() => { $status.innerHTML = cPT(); }, 500);
            return;
        }
        // Online: Make local move and send to server
        hCPly(c, i);
        sendData({ type: 'move', data: { index: i } });
        hRV();
    } else {
        // Offline: Local move and check
        hCPly(c, i);
        hRV();
    }
};
const hMove = i => {
    // Used for moves received from server (opponent's move)
    const c = $cells[i];
    if (gS[i] !== "") return; 
    hCPly(c, i);
    hRV();
};
const hRst = () => {
    gameOn = true; cP = P_X; gS.fill("");
    $status.classList.remove('draw-flash'); 
    cP = P_X; // Always Player X starts
    if (isOnline) isMyTurn = isHost; // Host (X) starts first
    $status.innerHTML = cPT();
    $cells.forEach(c => {
        c.innerHTML = ""; c.classList.remove(CLS_X, CLS_O); c.style.color = ""; 
    });
    $line.style.opacity = '0'; $line.style.transform = 'none'; $line.style.left = '0'; $line.style.top = '0';
};
const hRstS = () => { sX = 0; sO = 0; uScore(); };

// F. Mode Toggle & Lobby Logic
const uMBtn = () => {
    const $i = $mBtn.querySelector('.icon');
    $mBtn.classList.toggle('mode-online', isOnline);
    $mBtn.classList.toggle('mode-offline', !isOnline);
    $mBtn.title = isOnline ? "Switch to Offline (Local) Mode" : "Switch to Online Mode";
    $i.innerHTML = isOnline ? '&#x1f517;' : '&#x1f4bb;';
    $mBtn.textContent = `${isOnline ? "Online" : "Offline"} Mode `;
    $mBtn.appendChild($i);
};
const openLobby = () => {
    $lMod.classList.add('open');
    $rDSp.style.display = 'none'; 
    $lStat.textContent = "Connecting to server...";
    $cRBtn.disabled = true;
    $jRBtn.disabled = true;
    currentRoomID = null;

    // Connect WebSocket
    ws = new WebSocket(SERVER_URL);
    ws.onopen = () => {
        $lStat.textContent = "Connected! Please Create or Join a Room.";
        $cRBtn.disabled = false;
        $jRBtn.disabled = false;
    };
    ws.onmessage = handleServerMessage;
    ws.onerror = (err) => {
        $lStat.textContent = "Error connecting to server. Is the server running? Check your IP.";
        console.error('WebSocket Error:', err);
        // Note: Do not call closeLobby() here, let onclose handle it if needed
    };
    ws.onclose = () => {
        if (isOnline) {
             alert('Server connection closed. Returning to Offline Mode.');
             isOnline = false;
             uMBtn();
             hRst();
             closeLobby();
        }
    };
};
const closeLobby = () => {
    $lMod.classList.remove('open');
    if (isOnline && ws) {
        ws.close();
    }
    isOnline = false;
    uMBtn();
    hRst();
    currentRoomID = null;
    $jRIn.value = '';
    $rCDisp.textContent = '';
    isHost = false;
};
const hMTg = () => {
    if (isOnline) {
        // Switching OFF
        closeLobby();
        hRstS();
    } else {
        // Switching ON
        isOnline = true;
        uMBtn();
        hRst();
        hRstS();
        openLobby();
    }
};

// G. WebSocket Functions
const sendData = data => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
};

const handleServerMessage = event => {
    const msg = JSON.parse(event.data);
    const { type, data } = msg;

    if (type === 'roomCreated') {
        currentRoomID = data.roomID;
        $rCDisp.textContent = currentRoomID;
        $rDSp.style.display = 'flex';
        $lStat.textContent = `Room ${currentRoomID} created. Waiting for Mate to Join...`;
        $cRBtn.disabled = true;
        $jRBtn.disabled = true;
    } else if (type === 'start') {
        // Game Start signal from server
        isHost = data.isHostStart; // The server tells the client its role (Host/Opponent)
        $lMod.classList.remove('open');
        hRst();
    } else if (type === 'move') {
        // Opponent's move received
        hMove(data.index);
    } else if (type === 'reset') {
        // Server confirms reset initiated by either player
        setTimeout(hRst, R_DLY);
    } else if (type === 'error') {
        // Error from server (e.g., room full, opponent disconnected)
        alert(data.message);
        if (data.message.includes('disconnected')) {
             closeLobby(); // Close everything if opponent left
        } else {
             $lStat.textContent = data.message;
             $cRBtn.disabled = false;
             $jRBtn.disabled = false;
        }
    }
};


// LOBBY FUNCTIONS (Now communicate with the server)
const hCreateRoom = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        $lStat.textContent = "Not connected. Please wait or check server address.";
        return;
    }
    isHost = true; // Set role temporarily
    sendData({ type: 'create' });
    $lStat.textContent = "Requesting room...";
};

const hJoinRoom = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        $lStat.textContent = "Not connected. Please wait or check server address.";
        return;
    }
    const inputCode = $jRIn.value.trim().toUpperCase();
    if (inputCode.length !== 5) {alert("Please enter a valid 5-character Code."); return;}
    
    isHost = false; // Set role temporarily
    sendData({ type: 'join', data: { room: inputCode } });
    $lStat.textContent = `Requesting to join ${inputCode}...`;
};

const hCopyCode = () => {
    navigator.clipboard.writeText(currentRoomID).then(() => {
        const originalText = $cCBtn.textContent;
        $cCBtn.textContent = 'Copied!';
        setTimeout(() => { $cCBtn.textContent = originalText; }, 1000);
    }).catch(err => {
        alert('Could not copy text to clipboard.');
    });
};

// G. Reset Score (Only local)
const sendReset = () => {
    hRstS(); 
};


// H. Menu & Modal Functions (Omitted for compression, logic unchanged)
const tMenu = () => {
    $menu.classList.toggle('open'); 
    $overlay.classList.toggle('visible'); 
    $cMod.classList.remove('open');
    $sMod.classList.remove('open'); 
    $lMod.classList.remove('open'); 
    document.body.classList.toggle('menu-open'); 
};
const oSS = () => {
    $sBtns.forEach(b => b.classList.remove('selected'));
    $(`#sign-${ySign.toLowerCase()}-btn`).classList.add('selected');
    $sMod.classList.add('open');
};
const cSS = () => $sMod.classList.remove('open');
const cSPr = e => {
    const s = e.target.dataset.sign;
    if (s && (s === P_X || s === P_O)) {
        ySign = s; $sBtns.forEach(b => b.classList.remove('selected')); e.target.classList.add('selected');
        // FIX APPLIED HERE: The ternary operator was misplaced
        if (gameOn || gS.some(c => c !== "")) {$cells.forEach((c, i) => c.innerHTML = gS[i] !== "" ? gDM(gS[i]) : "");}
        $status.innerHTML = cPT(); uScore(); cSS();
    }
};
const uPFC = cStr => {
    const cObj = pColor(cStr);
    if (!cObj) return;
    const { r, g, b, a, h, s, l } = cObj;
    $hSl.value = h; $sSl.value = s; $aSl.value = a * 100;
    $cIn.value = cToF(cObj, cF);
    $cPrev.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    uSG(h, s, l, a);
};
const oCP = p => {
    activeP = p; $pLbl.textContent = p;
    uPFC(p === "You" ? cX : cO);
    $cMod.classList.add('open');
};
const cCP = () => { $cMod.classList.remove('open'); activeP = null; $tMenu.classList.remove('open'); };
const uPFS = () => {
    const h = +$hSl.value, s = +$sSl.value, a = +$aSl.value / 100; 
    const [r, g, b] = hToR(h, s, 50);
    const cObj = pColor(`rgba(${r}, ${g}, ${b}, ${a})`);
    $cIn.value = cToF(cObj, cF);
    $cPrev.style.backgroundColor = `rgba(${cObj.r}, ${cObj.g}, ${cObj.b}, ${cObj.a})`;
    uSG(h, s, 50, a);
};
const uSG = (h, s, l, a) => {
    $sSl.style.background = `linear-gradient(to right, hsl(${h}, 0%, 50%), hsl(${h}, 100%, 50%))`;
    const rGB = hToR(h, s, 50).join(',');
    $aSl.style.background = `linear-gradient(to right, rgba(${rGB}, 0), rgba(${rGB}, 1))`;
};
const sNC = () => {
    const nCS = $cIn.value;
    const cObj = pColor(nCS);
    if (!cObj) { alert("Please enter a valid color code."); return; }
    const nCR = cToF(cObj, 'RGBA');
    const [oPC, tCV] = activeP === "You" ? [cO, 'X'] : [cX, 'O'];
    const oCSO = pColor(oPC);
    if (cObj.hex.toLowerCase() === oCSO.hex.toLowerCase()) { alert("Error: The colour cannot be the same as the other player's colour!"); return; }
    tCV === 'X' ? cX = nCR : cO = nCR;
    aCols(); cCP(); 
};


// I. Event Listeners
$cells.forEach(c => c.addEventListener('click', hCC));
$rBtn.addEventListener('click', sendReset); 
$mBtn.addEventListener('click', hMTg);
if ($cRBtn) $cRBtn.addEventListener('click', hCreateRoom);
if ($cCBtn) $cCBtn.addEventListener('click', hCopyCode);
if ($jRBtn) $jRBtn.addEventListener('click', hJoinRoom);
if ($cLBtn) $cLBtn.addEventListener('click', closeLobby);
if ($lMod) $lMod.addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) { closeLobby(); } });
if ($sSel) $sSel.addEventListener('click', oSS);
if ($sCl) $sCl.addEventListener('click', cSS);
if ($sMod) $sMod.querySelector('.sign-options').addEventListener('click', cSPr);
if ($sBtn) $sBtn.addEventListener('click', tMenu);
if ($oBtn) $oBtn.addEventListener('click', tMenu);
if ($overlay) $overlay.addEventListener('click', tMenu);
if ($cYr) $cYr.addEventListener('click', () => { oCP("You"); });
if ($cMt) $cMt.addEventListener('click', () => { oCP("Mate"); });
if ($tBtn) $tBtn.addEventListener('click', () => $tMenu.classList.toggle('open'));
if ($tMenu) $tMenu.addEventListener('click', e => {
    const nF = e.target.dataset.format;
    if (nF) {
        cF = nF; $tDisp.textContent = nF;
        const cObj = pColor($cPrev.style.backgroundColor);
        if (cObj) { $cIn.value = cToF(cObj, cF); }
        $tMenu.classList.remove('open');
    }
});
if ($hSl) $hSl.addEventListener('input', uPFS);
if ($sSl) $sSl.addEventListener('input', uPFS);
if ($aSl) $aSl.addEventListener('input', uPFS); 
if ($cIn) $cIn.addEventListener('input', e => {
    const i = e.target.value.trim();
    if (i.startsWith('#') && i.length >= 4 || i.startsWith('rgb') || i.startsWith('hsl')) { uPFC(i); }
});
if ($sBtnS) $sBtnS.addEventListener('click', sNC);
if ($('#cancel-color-btn')) $('#cancel-color-btn').addEventListener('click', cCP);
if ($cMod) $cMod.addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop')) { cCP(); } });


// J. Initial Setup
aCols();
uScore();
uMBtn();
$status.innerHTML = cPT();
