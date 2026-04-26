let rawData = null;
let errorsState = [];

// --- NAVIGATION & WORKFLOW ---
function navTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Hintergrund abdunkeln für Screen 2, 3 und 4
    if(screenId !== 'screen-1') {
        document.body.classList.add('work-mode');
    } else {
        document.body.classList.remove('work-mode');
    }
}

function emergencyExit() {
    if(confirm("Bist du sicher? Der aktuelle KI-Output und Schülertext werden gelöscht. Content Points bleiben erhalten.")) {
        document.getElementById('studentText').value = "";
        document.getElementById('jsonInput').value = "";
        document.getElementById('loop-controls').style.display = "none";
        document.getElementById('btn-export').style.display = "block";
        navTo('screen-2');
    }
}

// --- LOOP FUNKTIONEN (BELOHNUNGEN) ---
function loopSameGenre() {
    document.getElementById('studentText').value = "";
    document.getElementById('jsonInput').value = "";
    document.getElementById('loop-controls').style.display = "none";
    document.getElementById('btn-export').style.display = "block";
    navTo('screen-2');
}

function loopNewGenre() {
    // Alles komplett zurücksetzen
    document.getElementById('contentPoints').value = "";
    document.getElementById('studentText').value = "";
    document.getElementById('jsonInput').value = "";
    document.getElementById('loop-controls').style.display = "none";
    document.getElementById('btn-export').style.display = "block";
    document.getElementById('appMode').selectedIndex = 0;
    document.getElementById('textType').selectedIndex = 0;
    updateSubtypes();
    navTo('screen-1');
}

// --- UI UPDATES ---
function updateSubtypes() {
    const main = document.getElementById('textType').value;
    const sub = document.getElementById('subType');
    if (main === 'letter') {
        sub.innerHTML = '<option value="personal">Personal Letter</option><option value="application">Letter of Application</option><option value="complaint">Letter of Complaint</option>';
    } else {
        sub.innerHTML = '<option value="blog">Blog</option><option value="article">Article</option><option value="diary">Diary Entry</option>';
    }
}

function updateGI(val) {
    document.querySelectorAll('.gi-btn').forEach((b, i) => {
        b.classList.toggle('active', i === val);
    });
}

// --- PROMPT GENERIERUNG (Screen 2 -> 3) ---
function copyPromptAndProceed() {
    const type = document.getElementById('textType').value;
    const sub = document.getElementById('subType').selectedOptions[0].text;
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    if (!text || !cp) {
        alert("Bitte fülle Content Points und Schülertext aus!");
        return;
    }

    const systemPrompt = `Du bist der KI-Tutor "Check Prompt Sherlock".
Textart: ${sub}
Content Points: [ ${cp} ]
Schülertext: """ ${text} """
AUFGABE: Analysiere den Text und erzeuge NUR ein JSON-Objekt.
STRUKTUR:
{
  "formalities": ${type === 'letter' ? '{"salutation": true, "reference": true, "call_to_action": true, "closing": true, "suggested_gi": 2}' : 'null'},
  "errors": [
    {"type": "grammar", "original": "...", "correction": "...", "explanation": "Kurze Erklärung"},
    {"type": "word_order", "original": "...", "correction": "...", "explanation": null},
    {"type": "spelling", "original": "...", "correction": "...", "explanation": null}
  ]
}`;

    navigator.clipboard.writeText(systemPrompt).then(() => {
        navTo('screen-3');
    }).catch(err => {
        alert("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
        navTo('screen-3');
    });
}

// --- JSON VERARBEITUNG (Screen 3 -> 4) ---
function processData() {
    const input = document.getElementById('jsonInput').value;
    try {
        const extracted = input.match(/\{[\s\S]*\}/);
        if (!extracted) throw new Error("Kein JSON gefunden.");
        
        rawData = JSON.parse(extracted[0]);
        errorsState = rawData.errors || [];
        
        buildDashboard();
        navTo('screen-4');
    } catch (e) {
        alert("Fehler: JSON ungültig. Bitte prüfe die KI-Antwort.");
    }
}

function buildDashboard() {
    // Formalitäten
    const section = document.getElementById('formalitiesSection');
    const list = document.getElementById('formalChecklist');
    const f = rawData.formalities;

    if (!f) {
        section.classList.add('hidden');
        updateGI(2);
    } else {
        section.classList.remove('hidden');
        list.innerHTML = "";
        const mapping = { salutation: "Anrede", reference: "Bezug", call_to_action: "Forderung/Angebot", closing: "Grußformel" };
        for (let key in mapping) {
            if(f[key] !== undefined) {
                list.innerHTML += `<li>${f[key] ? '✅' : '❌'} ${mapping[key]}</li>`;
            }
        }
        updateGI(f.suggested_gi !== undefined ? f.suggested_gi : 2);
    }

    // Triage Listen
    const gArea = document.getElementById('grammarArea');
    const mArea = document.getElementById('minorArea');
    gArea.innerHTML = ""; mArea.innerHTML = "";

    errorsState.forEach((err, i) => {
        if (!err) return;
        if (err.type === 'grammar') {
            gArea.innerHTML += `
                <div class="card" id="e-${i}">
                    <div>
                        <div style="font-size:1.1em; margin-bottom:5px;"><s>${err.original}</s> &rarr; <b style="color:var(--success)">${err.correction}</b></div>
                        <div style="color:#666; font-size:0.9em;">${err.explanation}</div>
                    </div>
                    <button class="btn-reject" onclick="deleteError(${i})">Löschen</button>
                </div>`;
        } else {
            const label = err.type === 'word_order' ? 'SYNTAX' : 'SPELLING';
            mArea.innerHTML += `
                <div class="spelling-row" id="e-${i}">
                    <span><b>[${label}]</b> <s>${err.original}</s> &rarr; <b style="color:var(--success)">${err.correction}</b></span>
                    <button class="btn-reject" onclick="deleteError(${i})">X</button>
                </div>`;
        }
    });
}

function deleteError(i) {
    errorsState[i] = null;
    document.getElementById(`e-${i}`).remove();
}

// --- RTF EXPORT ---
function generateRTF() {
    const sub = document.getElementById('subType').selectedOptions[0].text;
    const gi = document.querySelector('.gi-btn.active').innerText;
    
    const validErrors = errorsState.filter(e => e !== null);
    const grammarRows = validErrors.filter(e => e.type === 'grammar').map(e => 
        `<tr><td><s>${e.original}</s></td><td><b>${e.correction}</b><br><small>${e.explanation}</small></td></tr>`
    ).join('');
    const minorRows = validErrors.filter(e => e.type !== 'grammar').map(e => 
        `<tr><td>[${e.type.toUpperCase()}] <s>${e.original}</s> &rarr; <b>${e.correction}</b></td></tr>`
    ).join('');

    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px;}
        th, td { border: 1px solid black; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; }
        .score { border: 2px solid black; padding: 10px; font-weight: bold; width: 250px; margin-bottom: 20px; }
    </style></head>
    <body>
        <h1>Feedback: ${sub}</h1>
        <div class="score">General Impression Score: ${gi} / 2 P.</div>
        <h2>PART B - Grammar & Learning Points</h2>
        <table><tr><th>Original</th><th>Korrektur & Erklärung</th></tr>${grammarRows || '<tr><td colspan="2">Keine gravierenden Fehler.</td></tr>'}</table>
        <h2>PART C - Correction List (Spelling & Word Order)</h2>
        <table><tr><th>Fehler & Korrektur</th></tr>${minorRows || '<tr><td>Keine Spelling/Syntax-Fehler.</td></tr>'}</table>
        <h2>PART D - Final Scoring</h2>
        <table><tr><th>Kategorie</th><th>Punkte</th></tr><tr><td>Content</td><td> / 10</td></tr><tr><td>Language</td><td> / 18</td></tr><tr><td>General Impression</td><td>${gi} / 2</td></tr><tr style="background:#f2f2f2"><td><b>GESAMT</b></td><td><b> / 30</b></td></tr></table>
    </body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Feedback_${sub.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // BELOHNUNG: Export-Button verstecken, Loop-Buttons anzeigen
    document.getElementById('btn-export').style.display = 'none';
    document.getElementById('loop-controls').style.display = 'flex';
}
