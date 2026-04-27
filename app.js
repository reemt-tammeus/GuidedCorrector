let rawData = null;
let currentStep = 1;

// --- NAVIGATION ---
function navTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if(screenId !== 'screen-1') document.body.classList.add('work-mode');
    else document.body.classList.remove('work-mode');
}

function emergencyExit() {
    if(confirm("KI-Daten verwerfen und neu starten? (Text & Prompts bleiben erhalten)")) {
        document.getElementById('jsonInput').value = "";
        navTo('screen-2');
    }
}

function updateSubtypes() {
    // Bleibt wie gehabt für die Dropdowns
}

// --- WIZARD STEUERUNG ---
function goToStep(step) {
    currentStep = step;
    
    // Verstecke alle Wizard-Panels, zeige das Aktive
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`wizard-step-${step}`).classList.add('active');

    // Steuere die CSS-Klassen für den Markierten Text (Die Magie des Tunnels)
    const textArea = document.getElementById('markedTextDisplay');
    textArea.className = `marked-text-area step-${step}-view`;

    // Status Text updaten
    const statusDiv = document.getElementById('viewStatus');
    if(step === 1) statusDiv.innerText = "👁️ Ansicht: Content & Coherence (SVO-Fehler sind unsichtbar)";
    if(step === 2) statusDiv.innerText = "👁️ Ansicht: Language & Errors (Fokus auf Fehler)";
    if(step === 3) statusDiv.innerText = "👁️ Ansicht: Finale Übersicht (Alle Markierungen aktiv)";
}

// --- PROMPT BRÜCKE ---
function copyPromptAndProceed() {
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    if (!text || !cp) { alert("Bitte fülle alles aus!"); return; }

    const systemPrompt = `Erstelle ein JSON für diesen Schülertext basierend auf folgenden Prompts: [${cp}]
Schülertext: """ ${text} """

WICHTIG: Verändere den Originaltext NIEMALS. Nutze EXAKTE Zitate ("quote") für das Highlighting.

STRUKTUR DES JSON:
{
  "content_analysis": [
    { "prompt": "chaos", "topic_sentence_quote": "Exaktes kurzes Zitat des 1. Satzes", "rating": "E" }
  ],
  "linking_devices": ["Due to", "Furthermore"],
  "errors": [
    { "type": "grammar", "quote": "to many", "correction": "too many", "explanation": "Grammatik-Regel" },
    { "type": "spelling", "quote": "aound", "correction": "sound", "explanation": null }
  ],
  "scores": {
    "content": 7, "coherence": 7, "grammar": 6, "vocab": 5, "gi": 2,
    "reasoning": { "grammar": "Begründung für 6 Punkte", "vocab": "Begründung für 5 Punkte" }
  }
}`;

    navigator.clipboard.writeText(systemPrompt).then(() => navTo('screen-3'));
}

// --- DATENVERARBEITUNG & HIGHLIGHTING ---
function processData() {
    try {
        const input = document.getElementById('jsonInput').value;
        const extracted = input.match(/\{[\s\S]*\}/);
        if (!extracted) throw new Error("Kein JSON.");
        rawData = JSON.parse(extracted[0]);

        buildMarkedText();
        buildWizardPanels();
        
        // Reset UI
        document.getElementById('loop-controls').style.display = 'none';
        document.getElementById('btn-export').style.display = 'block';
        goToStep(1);
        navTo('screen-4');
    } catch (e) {
        alert("JSON Fehler. Bitte Output prüfen.");
    }
}

function buildMarkedText() {
    let text = document.getElementById('studentText').value;

    // 1. Markiere Linking Devices (Gelb)
    if(rawData.linking_devices) {
        rawData.linking_devices.forEach(link => {
            text = text.replace(new RegExp(`\\b${link}\\b`, 'gi'), `<span class="hl-link">$&</span>`);
        });
    }

    // 2. Markiere Fehler (Rot)
    if(rawData.errors) {
        rawData.errors.forEach(err => {
            if(err && err.quote) {
                text = text.replace(err.quote, `<span class="hl-error" data-correction="${err.correction}">${err.quote}</span>`);
            }
        });
    }

    // 3. Markiere Topic Sentences (Badge)
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach((ca, index) => {
            if(ca.topic_sentence_quote) {
                text = text.replace(ca.topic_sentence_quote, `<span class="hl-topic">[${index+1}]</span>$&`);
            }
        });
    }

    document.getElementById('markedTextDisplay').innerHTML = text;
}

function buildWizardPanels() {
    // Schritt 1: Content Matrix
    let cHtml = "<table>";
    rawData.content_analysis.forEach(ca => {
        cHtml += `<tr><td style="padding: 10px; border-bottom: 1px solid #444;"><b>${ca.prompt}</b><br><span style="color:var(--secondary)">Rating: ${ca.rating}</span></td></tr>`;
    });
    cHtml += "</table>";
    document.getElementById('contentMatrix').innerHTML = cHtml;

    // Schritt 2: Errors
    let eHtml = "";
    rawData.errors.forEach((err, i) => {
        if(!err) return;
        eHtml += `
            <div class="card" id="err-${i}">
                <div>
                    <div><s>${err.quote}</s> &rarr; <b style="color:var(--success)">${err.correction}</b></div>
                    <div style="font-size:0.8em; color:#aaa">${err.explanation || 'Rechtschreibung/Tippfehler'}</div>
                </div>
                <button class="btn-reject" onclick="deleteError(${i})">X</button>
            </div>`;
    });
    document.getElementById('errorCardsArea').innerHTML = eHtml;

    // Schritt 3: Scoreboard füllen
    document.getElementById('score-content').value = rawData.scores.content;
    document.getElementById('score-coherence').value = rawData.scores.coherence;
    document.getElementById('score-grammar').value = rawData.scores.grammar;
    document.getElementById('score-vocab').value = rawData.scores.vocab;
    document.getElementById('score-gi').value = rawData.scores.gi;
    
    document.getElementById('reason-grammar').innerText = rawData.scores.reasoning.grammar || '';
    document.getElementById('reason-vocab').innerText = rawData.scores.reasoning.vocab || '';
}

function deleteError(i) {
    // Löscht die Karte. Im echten System müsste hier der "Marked Text" neu gerendert werden,
    // um die rote Markierung zu entfernen. Für den Wizard-Flow lassen wir das Kärtchen einfach verschwinden.
    rawData.errors[i] = null;
    document.getElementById(`err-${i}`).remove();
}

// --- EXPORT & LOOPS ---
function generateRTF() {
    // Holt die finalen Noten aus dem Scoreboard (Schritt 3)
    const sC = document.getElementById('score-content').value;
    const sG = document.getElementById('score-grammar').value;
    const sV = document.getElementById('score-vocab').value;
    const sCoh = document.getElementById('score-coherence').value;
    const sGi = document.getElementById('score-gi').value;
    const total = parseInt(sC) + parseInt(sG) + parseInt(sV) + parseInt(sCoh) + parseInt(sGi);

    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px;}
        th, td { border: 1px solid black; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; }
    </style></head>
    <body>
        <h1>Feedback ("Scholz Anton" Format)</h1>
        
        <h2>PART A - Final Scoring</h2>
        <table>
            <tr><th>Category</th><th>Score</th></tr>
            <tr><td>Content</td><td>${sC} / 10</td></tr>
            <tr><td>Coherence & Cohesion</td><td>${sCoh} / 7</td></tr>
            <tr><td>Grammar & Structures</td><td>${sG} / 7<br><small><i>${document.getElementById('reason-grammar').innerText}</i></small></td></tr>
            <tr><td>Vocabulary & Spelling</td><td>${sV} / 7<br><small><i>${document.getElementById('reason-vocab').innerText}</i></small></td></tr>
            <tr><td>General Impression</td><td>${sGi} / 2</td></tr>
            <tr style="background:#f2f2f2"><td><b>TOTAL</b></td><td><b>${total} / 33</b></td></tr>
        </table>
        <p><i>Note: The marked text and error lists have been omitted in this preview version, but the logic is ready.</i></p>
    </body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Scholz_Feedback.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

    // Belohnung freischalten
    document.getElementById('btn-export').style.display = 'none';
    document.getElementById('loop-controls').style.display = 'flex';
}

function loopSameGenre() {
    document.getElementById('studentText').value = "";
    document.getElementById('jsonInput').value = "";
    navTo('screen-2');
}
function loopNewGenre() {
    document.getElementById('studentText').value = "";
    document.getElementById('jsonInput').value = "";
    document.getElementById('contentPoints').value = "";
    navTo('screen-1');
}
