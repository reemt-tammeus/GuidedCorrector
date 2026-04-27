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

function updateSubtypes() {}

// --- WIZARD STEUERUNG ---
function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`wizard-step-${step}`).classList.add('active');

    const textArea = document.getElementById('markedTextDisplay');
    textArea.className = `marked-text-area step-${step}-view`;

    const statusDiv = document.getElementById('viewStatus');
    const statusText = [
        "👁️ Ansicht 1: Content (F/E/I/N)",
        "👁️ Ansicht 2: Coherence (Linking Devices)",
        "👁️ Ansicht 3: Grammar (Grammatikfehler)",
        "👁️ Ansicht 4: Vocabulary (Wortschatz & Spelling)",
        "👁️ Ansicht 5: Finale Gesamtübersicht"
    ];
    statusDiv.innerText = statusText[step-1];
}

// --- PROMPT BRÜCKE ---
function copyPromptAndProceed() {
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    if (!text || !cp) { alert("Bitte fülle alles aus!"); return; }
    // Hinweis: Kopiert den strengen Master-Prompt.
    const systemPrompt = `[MASTER PROMPT HIEREIN KOPIEREN]`;
    navigator.clipboard.writeText("Bitte füge das JSON basierend auf dem System-Prompt ein.").then(() => navTo('screen-3'));
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

    // Linking Devices (☑)
    if(rawData.language_structures && rawData.language_structures.linking_devices) {
        rawData.language_structures.linking_devices.forEach(link => {
            let safeLink = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(`\\b${safeLink}\\b`, 'g'), `<span class="hl-link"><span class="sym">☑ </span>$&</span>`);
        });
    }

    // Errors (☐) - Getrennt nach Grammar und Vocab
    if(rawData.errors) {
        rawData.errors.forEach(err => {
            if(err && err.quote) {
                let cssClass = err.type === 'grammar' ? 'hl-grammar' : 'hl-vocab';
                text = text.replace(err.quote, `<span class="${cssClass}"><span class="sym">☐ </span><s>${err.quote}</s></span>`);
            }
        });
    }

    // Topic Sentences (Zahlen ¹²)
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach((ca, index) => {
            if(ca.topic_sentence_quote) {
                let sup = ["¹", "²", "³", "⁴", "⁵"][index] || `[${index+1}]`;
                text = text.replace(ca.topic_sentence_quote, `<span class="hl-topic"><span class="sym">${sup} </span>$&</span>`);
            }
        });
    }

    document.getElementById('markedTextDisplay').innerHTML = text;
}

function buildWizardPanels() {
    // 1. Content
    let cHtml = "<table style='width:100%; font-size:0.9em; text-align:left;'><tr><th>Prompt</th><th>Topic Sentence</th><th>SP</th><th>Rating</th></tr>";
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            cHtml += `<tr><td style='border-bottom:1px solid #444; padding:5px;'>${ca.prompt}</td><td style='border-bottom:1px solid #444; padding:5px;'><i>${ca.topic_sentence_quote}</i></td><td style='border-bottom:1px solid #444; padding:5px;'>${ca.supporting_points||0}</td><td style='border-bottom:1px solid #444; padding:5px; color:var(--secondary); font-weight:bold;'>${ca.rating}</td></tr>`;
        });
    }
    cHtml += "</table>";
    document.getElementById('contentMatrix').innerHTML = cHtml;

    // 2. Coherence
    if(rawData.language_structures) {
        document.getElementById('linkingList').innerText = (rawData.language_structures.linking_devices || []).join(', ');
        document.getElementById('complexList').innerText = (rawData.language_structures.complex_structures || []).join(', ');
    }

    // 3 & 4. Errors aufteilen
    let gramHtml = "", vocHtml = "";
    if(rawData.errors) {
        rawData.errors.forEach((err, i) => {
            if(!err) return;
            let card = `
                <div class="card" id="err-${i}">
                    <div>
                        <div><s>${err.quote}</s> &rarr; <b style="color:var(--success)">${err.correction}</b></div>
                        <div style="font-size:0.8em; color:#aaa">${err.explanation || 'Rechtschreibung'}</div>
                    </div>
                    <button class="btn-reject" onclick="deleteError(${i})">X</button>
                </div>`;
            if(err.type === 'grammar') gramHtml += card;
            else vocHtml += card;
        });
    }
    document.getElementById('grammarCardsArea').innerHTML = gramHtml || '<p style="color:var(--success)">Keine Grammatikfehler.</p>';
    document.getElementById('vocabCardsArea').innerHTML = vocHtml || '<p style="color:var(--success)">Keine Vokabel/Spelling-Fehler.</p>';

    // 5. Formalities
    let fHtml = "";
    if(rawData.formalities) {
        fHtml += `<li>Salutation: ${rawData.formalities.salutation_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Closing: ${rawData.formalities.closing_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Paragraphing: ${rawData.formalities.paragraphs_correct ? '✅' : '❌'}</li>`;
    }
    document.getElementById('formalChecklist').innerHTML = fHtml;

    // Scoreboard vorbefüllen (Max 7/7/7/7/2)
    if(rawData.scores) {
        document.getElementById('score-content').value = Math.min(rawData.scores.content || 0, 7);
        document.getElementById('score-coherence').value = Math.min(rawData.scores.coherence || 0, 7);
        document.getElementById('score-grammar').value = Math.min(rawData.scores.grammar || 0, 7);
        document.getElementById('score-vocab').value = Math.min(rawData.scores.vocab || 0, 7);
        document.getElementById('score-gi').value = Math.min(rawData.scores.gi || 0, 2);
        
        if(rawData.scores.reasoning) {
            document.getElementById('reason-content').value = rawData.scores.reasoning.content || '';
            document.getElementById('reason-coherence').value = rawData.scores.reasoning.coherence || '';
            document.getElementById('reason-grammar').value = rawData.scores.reasoning.grammar || '';
            document.getElementById('reason-vocab').value = rawData.scores.reasoning.vocab || '';
            document.getElementById('reason-gi').value = rawData.scores.reasoning.gi || '';
        }
    }
}

function deleteError(i) {
    rawData.errors[i] = null;
    document.getElementById(`err-${i}`).remove();
    buildMarkedText(); // Rendert den Text neu ohne diesen Fehler
}

// --- EXPORT (Das exakte Scholz Anton Format) ---
function generateRTF() {
    const sC = parseInt(document.getElementById('score-content').value) || 0;
    const sCoh = parseInt(document.getElementById('score-coherence').value) || 0;
    const sG = parseInt(document.getElementById('score-grammar').value) || 0;
    const sV = parseInt(document.getElementById('score-vocab').value) || 0;
    const sGi = parseInt(document.getElementById('score-gi').value) || 0;
    const total = sC + sCoh + sG + sV + sGi;

    const rC = document.getElementById('reason-content').value;
    const rCoh = document.getElementById('reason-coherence').value;
    const rG = document.getElementById('reason-grammar').value;
    const rV = document.getElementById('reason-vocab').value;
    const rGi = document.getElementById('reason-gi').value;

    // Tabellen generieren
    let cRows = "";
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            cRows += `<tr><td>${ca.prompt}</td><td><i>${ca.topic_sentence_quote}</i></td><td>${ca.supporting_points||0}</td><td><b>${ca.rating}</b></td></tr>`;
        });
    }

    let gRows = "", vRows = "";
    if(rawData.errors) {
        rawData.errors.forEach(err => {
            if(!err) return;
            let row = `<tr><td><s>${err.quote}</s></td><td>${err.correction}</td><td>${err.explanation || ''}</td></tr>`;
            if(err.type === 'grammar') gRows += row;
            else vRows += row;
        });
    }

    const linking = (rawData.language_structures && rawData.language_structures.linking_devices) ? rawData.language_structures.linking_devices.join(', ') : '';
    const complex = (rawData.language_structures && rawData.language_structures.complex_structures) ? rawData.language_structures.complex_structures.join(', ') : '';
    
    // HTML-Engine bereitet den markierten Text für Word vor (Emojis sind bereits injiziert)
    let textForWord = document.getElementById('markedTextDisplay').innerHTML.replace(/<span class="[^"]*">/g, '').replace(/<\/span>/g, '').replace(/\n/g, '<br><br>');

    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; }
        h1, h2, h3 { color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px;}
        th, td { border: 1px solid black; padding: 6px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; }
    </style></head>
    <body>
        <h1>PART A - Marked Learner Text</h1>
        <p>${textForWord}</p>
        <br>
        
        <h1>PART B - Detailed Analysis</h1>
        
        <h3>1) CONTENT</h3>
        <table>
            <tr><th>Prompt Requirement</th><th>Topic Sentence identified?</th><th>Supporting Points (SP)</th><th>Rating (F/E/I/N)</th></tr>
            ${cRows}
        </table>

        <h3>2) GRAMMAR & STRUCTURES</h3>
        <p><b>Mistakes:</b></p>
        <table>
            <tr><th width="30%">Incorrect Form</th><th width="30%">Correction</th><th width="40%">Explanation</th></tr>
            ${gRows || '<tr><td colspan="3">No mistakes</td></tr>'}
        </table>
        <p><b>Complex Structures Used:</b> ${complex}</p>

        <h3>3) VOCABULARY & SPELLING</h3>
        <p><b>Mistakes:</b></p>
        <table>
            <tr><th width="30%">Incorrect Form</th><th width="30%">Correction</th><th width="40%">Explanation</th></tr>
            ${vRows || '<tr><td colspan="3">No mistakes</td></tr>'}
        </table>

        <h3>4) COHERENCE & COHESION</h3>
        <p><b>Linking Devices Used:</b> ${linking}</p>
        <br>

        <h1>PART C - Final Scoring Overview</h1>
        <table>
            <tr><th width="20%">Category</th><th width="15%">Score</th><th width="65%">Comment / Observation</th></tr>
            <tr><td>Content</td><td>${sC} / 7</td><td>${rC}</td></tr>
            <tr><td>Coherence</td><td>${sCoh} / 7</td><td>${rCoh}</td></tr>
            <tr><td>Grammar</td><td>${sG} / 7</td><td>${rG}</td></tr>
            <tr><td>Vocabulary</td><td>${sV} / 7</td><td>${rV}</td></tr>
            <tr><td>Gen. Impression</td><td>${sGi} / 2</td><td>${rGi}</td></tr>
            <tr style="background:#f2f2f2"><td><b>TOTAL</b></td><td><b>${total} / 30</b></td><td></td></tr>
        </table>
    </body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Scholz_Anton_Feedback.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);

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
