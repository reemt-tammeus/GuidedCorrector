// Globale Variablen für den Zustand
let currentData = null;
let parsedErrors = [];

// --- UI STEUERUNG ---

function toggleSubtype() {
    const type = document.getElementById('textType').value;
    const sub = document.getElementById('subType');
    if (type === 'letter') {
        sub.innerHTML = '<option value="personal">Personal Letter</option><option value="application">Letter of Application</option><option value="complaint">Letter of Complaint</option>';
    } else {
        sub.innerHTML = '<option value="blog">Blog</option><option value="article">Article</option><option value="diary">Diary Entry</option>';
    }
}

function setGI(score) {
    const buttons = document.querySelectorAll('.gi-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    buttons[score].classList.add('active');
}

// --- PROMPT GENERATOR ---

function generatePrompt() {
    const type = document.getElementById('textType').value;
    const subType = document.getElementById('subType').selectedOptions[0].text;
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    if (!text) {
        alert("Bitte zumindest einen Schülertext einfügen!");
        return;
    }

    let formalityRules = "";
    if (type === 'letter') {
        formalityRules = `
    "formalities": {
      "salutation": {"present": true/false},
      "reference": {"present": true/false},
      "call_to_action": {"present": true/false}, // Forderung oder Angebot
      "closing": {"present": true/false},
      "suggested_gi_score": (0 bis 2)
    },`;
    } else {
        formalityRules = `
    "formalities": null,`;
    }

    const fullPrompt = `Du bist ein strenger Korrektor für Englisch (B1+).
Analysiere folgenden Text (${subType}) basierend auf diesen Content Points:
[ ${cp} ]

Schülertext:
"""
${text}
"""

AUFGABE: Erstelle AUSSCHLIESSLICH ein JSON-Objekt. Keine Erklärungen davor oder danach. 
Nutze exakt diese Struktur:
{${formalityRules}
  "errors": [
    {
      "type": "grammar", // oder "word_order" oder "spelling"
      "original": "falscher Text",
      "correction": "korrekter Text",
      "explanation": "Kurze deutsche Erklärung (NUR bei grammar! Bei spelling und word_order MUSS dies null sein.)"
    }
  ]
}

REGELN:
1. Markiere bei 'word_order' (Syntax/SVO) und 'spelling' (Rechtschreibung) JEDEN Fehler. Setze 'explanation' auf null. Bewerte keinen reinen Stil.
2. Markiere bei 'grammar' die gravierendsten Fehler und liefere eine präzise Erklärung.`;

    navigator.clipboard.writeText(fullPrompt).then(() => {
        const feedback = document.getElementById('copyFeedback');
        feedback.style.display = 'inline';
        setTimeout(() => feedback.style.display = 'none', 3000);
    });
}

// --- JSON WASCHGANG & DASHBOARD RENDER ---

function processJSON() {
    const rawInput = document.getElementById('jsonInput').value;
    try {
        // Regex findet alles zwischen der ersten { und der letzten }
        const jsonMatch = rawInput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Kein JSON im Text gefunden.");
        
        currentData = JSON.parse(jsonMatch[0]);
        parsedErrors = currentData.errors || [];
        
        // Originaltext anzeigen
        document.getElementById('originalTextDisplay').innerText = document.getElementById('studentText').value;
        
        // Dashboard aufbauen
        buildFormalities();
        renderErrors();
        
        // UI umschalten
        document.getElementById('step1').classList.add('hidden');
        document.getElementById('step2').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        
    } catch (e) {
        alert("Fehler beim Auslesen des JSON: " + e.message + "\nBitte prüfe, ob die KI wirklich Code ausgegeben hat.");
    }
}

function buildFormalities() {
    const section = document.getElementById('formalitiesSection');
    const list = document.getElementById('formalChecklist');
    const isLetter = document.getElementById('textType').value === 'letter';
    
    if (!isLetter || !currentData.formalities) {
        section.classList.add('hidden');
        setGI(2); // Standardwert für Creative
        return;
    }
    
    section.classList.remove('hidden');
    list.innerHTML = "";
    const f = currentData.formalities;
    
    const addItem = (name, obj) => {
        if(obj) {
            const icon = obj.present ? '✅' : '❌';
            const color = obj.present ? 'green' : 'red';
            list.innerHTML += `<li style="color:${color}">${icon} ${name}</li>`;
        }
    };

    addItem("Anrede (Salutation)", f.salutation);
    addItem("Bezugnahme (Reference)", f.reference);
    addItem("Call to Action (Forderung/Angebot)", f.call_to_action);
    addItem("Verabschiedung (Closing)", f.closing);

    // KI Vorschlag übernehmen
    let suggested = f.suggested_gi_score !== undefined ? f.suggested_gi_score : 2;
    setGI(suggested);
}

function renderErrors() {
    const grammarCont = document.getElementById('grammarContainer');
    const minorCont = document.getElementById('minorErrorContainer');
    
    grammarCont.innerHTML = "";
    minorCont.innerHTML = "";
    
    let hasGrammar = false;

    parsedErrors.forEach((err, index) => {
        if (!err) return; // Falls gelöscht

        if (err.type === 'grammar') {
            hasGrammar = true;
            grammarCont.innerHTML += `
                <div class="card" id="err-${index}">
                    <div class="card-content">
                        <div class="correction-text"><s>${err.original}</s> &rarr; <b>${err.correction}</b></div>
                        <div class="explanation">${err.explanation || ''}</div>
                    </div>
                    <button class="btn-reject" onclick="removeError(${index})">Löschen</button>
                </div>`;
        } else {
            const badgeLabel = err.type === 'word_order' ? 'Syntax' : 'Spelling';
            minorCont.innerHTML += `
                <div class="spelling-row" id="err-${index}">
                    <div>
                        <span class="badge">${badgeLabel}</span>
                        <span><s>${err.original}</s> &rarr; <b>${err.correction}</b></span>
                    </div>
                    <button class="btn-reject" onclick="removeError(${index})">X</button>
                </div>`;
        }
    });

    document.getElementById('grammarEmpty').classList.toggle('hidden', hasGrammar);
}

function removeError(index) {
    parsedErrors[index] = null; // Element aus Daten-Array löschen
    document.getElementById(`err-${index}`).remove();
    
    // Prüfen ob Grammatik-Bereich jetzt leer ist
    if (!parsedErrors.some(e => e && e.type === 'grammar')) {
        document.getElementById('grammarEmpty').classList.remove('hidden');
    }
}

function acceptAllMinor() {
    alert("Alle verbleibenden Spelling & Syntax Fehler sind für den Export bestätigt!");
}

// --- RTF EXPORT ---

function exportToRTF() {
    const textType = document.getElementById('textType').options[document.getElementById('textType').selectedIndex].text;
    const subType = document.getElementById('subType').options[document.getElementById('subType').selectedIndex].text;
    const giActive = document.querySelector('.gi-btn.active');
    const giScore = giActive ? giActive.innerText : "0";
    
    // Aktive Fehler filtern
    const activeErrors = parsedErrors.filter(e => e !== null);
    const grammarRows = activeErrors.filter(e => e.type === 'grammar')
        .map(e => `<tr><td><s>${e.original}</s></td><td><b>${e.correction}</b><br><small><i>${e.explanation}</i></small></td></tr>`)
        .join('');
        
    const minorRows = activeErrors.filter(e => e.type !== 'grammar')
        .map(e => `<tr><td>[${e.type === 'word_order' ? 'Syntax' : 'Spelling'}] <s>${e.original}</s> &rarr; <b>${e.correction}</b></td></tr>`)
        .join('');

    const htmlContent = `
        <html xmlns:office="urn:schemas-microsoft-com:office:office" xmlns:word="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.5; font-size: 12pt; }
                h1 { color: #2c3e50; border-bottom: 2px solid #2c3e50; font-size: 16pt; }
                h2 { color: #2980b9; margin-top: 20px; font-size: 14pt; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .gi-box { border: 2px solid #000; padding: 10px; font-weight: bold; width: 300px; }
            </style>
        </head>
        <body>
            <h1>Guided Writing Feedback</h1>
            <p><strong>Text Type:</strong> ${textType} (${subType})</p>
            
            <h2>PART A - General Impression</h2>
            <div class="gi-box">General Impression Score: ${giScore} / 2 Points</div>

            <h2>PART B - Major Learning Points (Grammar)</h2>
            <table>
                <tr><th width="40%">Incorrect Form</th><th width="60%">Correction & Explanation</th></tr>
                ${grammarRows || '<tr><td colspan="2">No major grammar errors. Well done!</td></tr>'}
            </table>

            <h2>PART C - Correction List (Spelling & Word Order)</h2>
            <table>
                <tr><th>Corrections</th></tr>
                ${minorRows || '<tr><td>No spelling or syntax errors.</td></tr>'}
            </table>

            <h2>PART D - Final Scoring Overview</h2>
            <table>
                <tr><th>Category</th><th>Score</th></tr>
                <tr><td>Content</td><td>      / 10</td></tr>
                <tr><td>Language (Grammar/Vocab/Coherence)</td><td>      / 18</td></tr>
                <tr><td>General Impression</td><td>  ${giScore}   / 2</td></tr>
                <tr style="background:#f2f2f2"><td><strong>TOTAL</strong></td><td><strong>      / 30</strong></td></tr>
            </table>
            <br>
            <p><em>Note: This is a practice correction to help you improve your writing.</em></p>
        </body>
        </html>
    `;

    // Download als .doc (RTF-kompatibel)
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Dateiname formatieren
    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = subType.replace(/\s+/g, '_');
    link.download = `Feedback_${safeName}_${dateStr}.doc`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}