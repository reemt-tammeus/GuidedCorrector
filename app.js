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

// --- DROPDOWN LOGIK ---
function updateSubtypes() {
    const textType = document.getElementById('textType').value;
    const subWrapper = document.getElementById('subTypeWrapper');
    if (textType === 'creative') {
        subWrapper.style.display = 'none';
    } else {
        subWrapper.style.display = 'block';
    }
}

// --- WIZARD STEUERUNG ---
function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`wizard-step-${step}`).classList.add('active');

    const textArea = document.getElementById('markedTextDisplay');
    textArea.className = `marked-text-area step-${step}-view`;

    const statusDiv = document.getElementById('viewStatus');
    const statusText = [
        "👁️ Ansicht 1: Content (Blaue Zahlen für 0=TS, 1,2..=SP)",
        "👁️ Ansicht 2: Coherence (Grün hinterlegte Linking Devices)",
        "👁️ Ansicht 3: Grammar (Fehler = Rot, Complex = Grün unterstrichen)",
        "👁️ Ansicht 4: Vocabulary (Fehler = Orange)",
        "👁️ Ansicht 5: Finale Gesamtübersicht (Alle Farben aktiv)"
    ];
    statusDiv.innerText = statusText[step-1];
}

// --- PROMPT BRÜCKE ---
function copyPromptAndProceed() {
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    if (!text || !cp) { alert("Bitte fülle alle Textfelder aus!"); return; }

    const systemPrompt = `Du bist der KI-Tutor "GuidedCorrector" (Level B1+).
Analysiere den folgenden Text basierend auf diesen Prompts: [${cp}]

Schülertext: """ ${text} """

WICHTIG: Verändere den Originaltext NIEMALS. Nutze EXAKTE Zitate aus dem Schülertext für das JSON.
Bei "content_analysis": Zitiere den Topic Sentence. Zitiere danach ALLE Supporting Points exakt als Array von Strings. Wenn der TS fehlt, lass das ts_quote leer und liefere nur die SPs.
Bei "complex_structures_quotes": Zitiere die genauen Passagen, in denen komplexe Strukturen vorkommen (auch fehlerhafte!).

Erzeuge AUSSCHLIESSLICH dieses JSON-Format als Antwort:
{
  "formalities": { "salutation_present": true, "closing_present": true, "paragraphs_correct": true },
  "content_analysis": [
    { "prompt": "Thema 1", "ts_quote": "Exact Topic Sentence", "sp_quotes": ["Exact SP 1", "Exact SP 2"], "rating": "F" }
  ],
  "language_structures": {
    "linking_devices": ["First of all", "Due to"],
    "complex_structures_quotes": ["which I visited", "how such a chaos can be created"]
  },
  "errors": [
    { "type": "grammar", "quote": "to many", "correction": "too many", "explanation": "Grund" },
    { "type": "vocab", "quote": "desaster", "correction": "disaster", "explanation": "Spelling" }
  ],
  "scores": {
    "content": 7, "coherence": 7, "grammar": 6, "vocab": 5, "gi": 2,
    "reasoning": { "content": "Kurz...", "coherence": "Kurz...", "grammar": "Kurz...", "vocab": "Kurz...", "gi": "Kurz..." }
  }
}`;

    navigator.clipboard.writeText(systemPrompt).then(() => {
        navTo('screen-3');
    }).catch(() => {
        alert("Kopieren fehlgeschlagen. Bitte erlaube den Zugriff auf die Zwischenablage.");
        navTo('screen-3');
    });
}

// --- DATENVERARBEITUNG & HIGHLIGHTING ---
function processData() {
    try {
        const input = document.getElementById('jsonInput').value;
        const extracted = input.match(/\{[\s\S]*\}/);
        if (!extracted) throw new Error("Kein JSON gefunden.");
        rawData = JSON.parse(extracted[0]);

        buildMarkedText();
        buildWizardPanels();
        
        document.getElementById('loop-controls').style.display = 'none';
        document.getElementById('btn-export').style.display = 'block';
        goToStep(1);
        navTo('screen-4');
    } catch (e) {
        alert("Fehler beim Auslesen des JSON. Bitte prüfe den Output der KI.");
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMarkedText() {
    let text = document.getElementById('studentText').value;

    // 1. Complex Structures (Grün unterstrichen - Größte Blöcke zuerst umklammern)
    if(rawData.language_structures && rawData.language_structures.complex_structures_quotes) {
        rawData.language_structures.complex_structures_quotes.forEach(quote => {
            if(quote) {
                let safeQuote = escapeRegExp(quote);
                text = text.replace(new RegExp(safeQuote, 'g'), `<span class="hl-complex" data-export="border-bottom: 2px solid #2ecc71;">$&</span>`);
            }
        });
    }

    // 2. Linking Devices (Grün)
    if(rawData.language_structures && rawData.language_structures.linking_devices) {
        rawData.language_structures.linking_devices.forEach(link => {
            let safeLink = escapeRegExp(link);
            text = text.replace(new RegExp(`\\b${safeLink}\\b`, 'g'), `<span class="hl-link" data-export="background-color: #a9dfbf; padding: 2px;">$&</span>`);
        });
    }

    // 3. Errors (Rot/Orange)
    if(rawData.errors) {
        rawData.errors.forEach(err => {
            if(err && err.quote) {
                let isGram = err.type === 'grammar';
                let cssClass = isGram ? 'hl-grammar' : 'hl-vocab';
                let expStyle = isGram ? 'background-color: #f5b7b1; padding: 2px;' : 'background-color: #fdebd0; padding: 2px;';
                
                // Wir suchen den exakten Fehler und wickeln ihn ein. 
                // Falls er in einem Span liegt, belassen wir das HTML intakt.
                let safeQuote = escapeRegExp(err.quote);
                text = text.replace(new RegExp(safeQuote, 'g'), `<span class="${cssClass}" data-export="${expStyle}">$&</span>`);
            }
        });
    }

    // 4. Content Analysis: Zahlen anhängen
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            // Topic Sentence = 0
            if(ca.ts_quote && ca.ts_quote.trim() !== "") {
                let safeTS = escapeRegExp(ca.ts_quote);
                text = text.replace(new RegExp(safeTS, 'g'), `$&<span class="hl-topic" data-export="color: #3498db; font-size: 0.8em; vertical-align: super;">0</span>`);
            }
            // Supporting Points = 1, 2, 3...
            if(ca.sp_quotes && ca.sp_quotes.length > 0) {
                ca.sp_quotes.forEach((sp, i) => {
                    if(sp && sp.trim() !== "") {
                        let safeSP = escapeRegExp(sp);
                        text = text.replace(new RegExp(safeSP, 'g'), `$&<span class="hl-topic" data-export="color: #3498db; font-size: 0.8em; vertical-align: super;">${i+1}</span>`);
                    }
                });
            }
        });
    }

    document.getElementById('markedTextDisplay').innerHTML = text;
}

function buildWizardPanels() {
    let cHtml = "<table style='width:100%; font-size:0.9em; text-align:left;'><tr><th>Prompt</th><th>Rating</th></tr>";
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            cHtml += `<tr><td style='border-bottom:1px solid #444; padding:5px;'>${ca.prompt}</td><td style='border-bottom:1px solid #444; padding:5px; color:var(--secondary); font-weight:bold;'>${ca.rating}</td></tr>`;
        });
    }
    cHtml += "</table>";
    document.getElementById('contentMatrix').innerHTML = cHtml;

    if(rawData.language_structures) {
        document.getElementById('linkingList').innerText = (rawData.language_structures.linking_devices || []).join(', ');
        document.getElementById('complexList').innerText = (rawData.language_structures.complex_structures_quotes || []).join(', ');
    }

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
                    <button class="btn-reject" onclick="deleteError(${i})">Löschen</button>
                </div>`;
            if(err.type === 'grammar') gramHtml += card;
            else vocHtml += card;
        });
    }
    document.getElementById('grammarCardsArea').innerHTML = gramHtml || '<p style="color:var(--success)">Keine Grammatikfehler gefunden.</p>';
    document.getElementById('vocabCardsArea').innerHTML = vocHtml || '<p style="color:var(--success)">Keine Vokabel/Spelling-Fehler gefunden.</p>';

    let fHtml = "";
    if(rawData.formalities) {
        fHtml += `<li>Salutation: ${rawData.formalities.salutation_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Closing: ${rawData.formalities.closing_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Paragraphing: ${rawData.formalities.paragraphs_correct ? '✅' : '❌'}</li>`;
    }
    document.getElementById('formalChecklist').innerHTML = fHtml;

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
    buildMarkedText(); 
}

// --- EXPORT (Das bunte Word Dokument) ---
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

    let cRows = "";
    if(rawData.content_analysis) {
        rawData.content_analysis.forEach(ca => {
            let spCount = ca.sp_quotes ? ca.sp_quotes.length : 0;
            let tsFound = (ca.ts_quote && ca.ts_quote.trim() !== "") ? "Yes" : "No";
            cRows += `<tr><td>${ca.prompt}</td><td>${tsFound}</td><td>${spCount}</td><td><b>${ca.rating}</b></td></tr>`;
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
    
    // Bereite Text für Word vor: Wandle die data-export Styles in echte Inline-Styles um
    let textHTML = document.getElementById('markedTextDisplay').innerHTML;
    textHTML = textHTML.replace(/\n/g, '<br><br>');
    // Regex sucht nach SPANs mit unseren Klassen und ersetzt class="..." durch style="..."
    textHTML = textHTML.replace(/class="hl-[^"]*"\s+data-export="([^"]*)"/g, 'style="$1"');

    const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
        h1, h2, h3 { color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px;}
        th, td { border: 1px solid black; padding: 6px; text-align: left; vertical-align: top; }
        th { background: #f2f2f2; }
        .legend { font-size: 9pt; border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; background: #fafafa; }
    </style></head>
    <body>
        <h1>PART A - Marked Learner Text</h1>
        
        <div class="legend">
            <b>Legend:</b> 
            <span style="color: #3498db; font-weight: bold;">0</span> = Topic Sentence | 
            <span style="color: #3498db; font-weight: bold;">1, 2, 3</span> = Supporting Points | 
            <span style="background-color: #a9dfbf;">Green Background</span> = Linking Devices | 
            <span style="border-bottom: 2px solid #2ecc71;">Green Underline</span> = Complex Structures | 
            <span style="background-color: #f5b7b1;">Red Background</span> = Grammar Errors | 
            <span style="background-color: #fdebd0;">Orange Background</span> = Vocab/Spelling Errors
        </div>

        <p>${textHTML}</p>
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
    const a = document.createElement('a'); a.href = url; a.download = `GuidedCorrector_Feedback.doc`;
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
