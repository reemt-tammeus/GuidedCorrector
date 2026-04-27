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
    // Falls später dynamisch Dropdowns angepasst werden sollen
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

    const systemPrompt = `Analysiere den Text basierend auf folgenden Prompts: [${cp}]
Schülertext: """ ${text} """

WICHTIG: Verändere den Originaltext NIEMALS. Nutze EXAKTE Zitate ("quote") für das Highlighting.
Erzeuge AUSSCHLIESSLICH dieses JSON-Format:
{
  "formalities": { "salutation_present": true, "closing_present": true, "paragraphs_correct": true },
  "content_analysis": [
    { "prompt": "Prompt 1", "topic_sentence_quote": "Exaktes Zitat", "supporting_points": 3, "rating": "F" }
  ],
  "language_structures": {
    "linking_devices": ["First of all", "Due to"],
    "complex_structures": ["Relative clauses"]
  },
  "errors": [
    { "type": "grammar", "quote": "to many", "correction": "too many", "explanation": "Grund" }
  ],
  "scores": {
    "content": 7, "coherence": 7, "grammar": 6, "vocab": 5, "gi": 2,
    "reasoning": { "grammar": "Kurze Begründung", "vocab": "Kurze Begründung" }
  }
}`;

    navigator.clipboard.writeText(systemPrompt).then(() => navTo('screen-3')).catch(() => {
        alert("Kopieren fehlgeschlagen. Bitte manuell kopieren.");
        navTo('screen-3');
    });
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
    if(rawData.language_structures && rawData.language_structures.linking_devices) {
        rawData.language_structures.linking_devices.forEach(link => {
            // Einfaches Escape für Regex, um Fehler bei Sonderzeichen zu vermeiden
            let safeLink = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(`\\b${safeLink}\\b`, 'gi'), `<span class="hl-link">$&</span>`);
        });
    }

    // 2. Markiere Fehler (Rot)
    if(rawData.errors) {
        rawData.errors.forEach(err => {
            if(err && err.quote) {
                text = text.replace(err.quote, `<span class="hl-error" title="${err.correction}">${err.quote}</span>`);
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
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            cHtml += `<tr><td style="padding: 10px; border-bottom: 1px solid #444;">
                <b>${ca.prompt}</b><br>
                <span style="color:var(--secondary)">Rating: ${ca.rating} (${ca.supporting_points || 0} SP)</span>
            </td></tr>`;
        });
    }
    cHtml += "</table>";
    document.getElementById('contentMatrix').innerHTML = cHtml;

    // Schritt 2: Errors
    let eHtml = "";
    if(rawData.errors) {
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
    }
    document.getElementById('errorCardsArea').innerHTML = eHtml;

    // Schritt 3: Scoreboard füllen
    if(rawData.scores) {
        document.getElementById('score-content').value = rawData.scores.content || 0;
        document.getElementById('score-coherence').value = rawData.scores.coherence || 0;
        document.getElementById('score-grammar').value = rawData.scores.grammar || 0;
        document.getElementById('score-vocab').value = rawData.scores.vocab || 0;
        document.getElementById('score-gi').value = rawData.scores.gi || 0;
        
        if(rawData.scores.reasoning) {
            document.getElementById('reason-grammar').innerText = rawData.scores.reasoning.grammar || '';
            document.getElementById('reason-vocab').innerText = rawData.scores.reasoning.vocab || '';
        }
    }
}

function deleteError(i) {
    rawData.errors[i] = null;
    document.getElementById(`err-${i}`).remove();
    // Um die Markierung im Text sofort zu entfernen, bauen wir den Text neu auf
    buildMarkedText();
}

// --- EXPORT & LOOPS ---
function generateRTF() {
    // Holt die finalen Noten aus dem Scoreboard (Schritt 3)
    const sC = parseInt(document.getElementById('score-content').value) || 0;
    const sG = parseInt(document.getElementById('score-grammar').value) || 0;
    const sV = parseInt(document.getElementById('score-vocab').value) || 0;
    const sCoh = parseInt(document.getElementById('score-coherence').value) || 0;
    const sGi = parseInt(document.getElementById('score-gi').value) || 0;
    const total = sC + sG + sV + sCoh + sGi;

    const rG = document.getElementById('reason-grammar').innerText;
    const rV = document.getElementById('reason-vocab').innerText;

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
            <tr><td>Grammar & Structures</td><td>${sG} / 7<br><small><i>${rG}</i></small></td></tr>
            <tr><td>Vocabulary & Spelling</td><td>${sV} / 7<br><small><i>${rV}</i></small></td></tr>
            <tr><td>General Impression</td><td>${sGi} / 2</td></tr>
            <tr style="background:#f2f2f2"><td><b>TOTAL</b></td><td><b>${total} / 33</b></td></tr>
        </table>
        <p><i>Note: The marked text and detailed error lists have been omitted in this preview version, but the scoring is based on the interactive analysis.</i></p>
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
