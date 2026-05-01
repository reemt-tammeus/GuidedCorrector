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

// --- PROMPT BRÜCKE (MIT AP-MATRIX UND AUFZÄHLUNGS-BREMSE) ---
function copyPromptAndProceed() {
    const cp = document.getElementById('contentPoints').value;
    const text = document.getElementById('studentText').value;

    const textType = document.getElementById('textType').value;
    const subType = document.getElementById('subType').value;

    if (!text || !cp) { 
        alert("Bitte fülle alle Textfelder aus!"); 
        return; 
    }

    let genreInstruction = "";
    if (textType === 'letter') {
        if (subType === 'complaint') {
            genreInstruction = "\nACHTUNG: Es handelt sich um eine Beschwerde. Prüfe zwingend, ob am Ende eine klare Forderung (Demand for action, refund, replacement) gestellt wird. Setze das Feld 'genre_requirement_met' auf true, wenn ja, sonst false.";
        } else if (subType === 'application') {
            genreInstruction = "\nACHTUNG: Es handelt sich um eine Bewerbung. Prüfe zwingend, ob am Ende ein Angebot für ein Vorstellungsgespräch oder Rückfragen (Offer for interview/contact) gemacht wird. Setze das Feld 'genre_requirement_met' auf true, wenn ja, sonst false.";
        }
    }

    const systemPrompt = `Du bist der KI-Tutor "GuidedCorrector" (Level B1+).
Analysiere den folgenden Text basierend auf diesen Prompts: [${cp}]

Schülertext: """ ${text} """

WICHTIGSTE REGELN FÜR DAS JSON:
1. ZITATE & SPLITTING: Verändere den Originaltext NIEMALS. Wenn ein Schüler Argumente in separaten Sätzen oder echten, eigenständigen Hauptsätzen formuliert, splitte sie auf und trage sie als separate Zitate in das "sp_quotes" Array ein (SP 1, SP 2, etc.). ABER ACHTUNG: Eine reine Aufzählung von Details innerhalb eines einzigen Satzes (z.B. verbunden durch Kommata oder 'and') darf unter keinen Umständen aufgesplittet werden! Sie gilt zwingend als exakt EIN einzelner Supporting Point (SP).
2. RATING (F/E/I/N): Vergib das Rating strikt nach diesem Schema:
   F = Fully elaborated (Topic Sentence + aufgesplittete Supporting Points vorhanden)
   E = Elaborated (Topic Sentence + max. 1 Supporting Point)
   I = Included (Erwähnt/Enthalten, meist nur der Topic Sentence)
   N = Not included (Nicht enthalten)
3. PUNKTE-MATHEMATIK (CONTENT): Der Content-Score (0-7) MUSS sich streng mathematisch aus den F/E/I/N Ratings der Prompts ableiten!
   7 Punkte: 4xF | 3xF + 1xE
   6 Punkte: 3xF + 1xI | 2xF + 2xE | 1xF + 3xE | 2xF + 1xE + 1xI
   5 Punkte: 3xF + 1xN | 4xE | 3xE + 1xI | 2xF + 2xI | 2xF + 1xE + 1xN | 1xF + 2xE + 1xI
   4 Punkte: 3xE + 1xN | 2xE + 2xI | 1xF + 1xE + 2xI | 2xF + 1xI + 1xN | 1xF + 2xE + 1xN
   3 Punkte: 2xE + 1xI + 1xN | 4xI | 3xI + 1xE | 1xF + 1xE + 1xI + 1xN | 1xF + 3xI | 2xF + 2xN
   2 Punkte: 3xI + 1xN | 2xI + 1xE + 1xN | 2xE + 2xN | 1xF + 2xI + 1xN | 1xE + 2xI + 1xN
   1 Punkt: 1xF + 3xN | 1xE + 3xN | 1xI + 3xN | 2xI + 2xN
   0 Punkte: 4xN
4. WEITERE SCORES: Halte dich an diese Maximalwerte: coherence (max 7), grammar (max 7), vocab (max 7), gi (max 2).${genreInstruction}

Erzeuge AUSSCHLIESSLICH dieses JSON-Format als Antwort:
{
  "formalities": { "salutation_present": true, "closing_present": true, "paragraphs_correct": true, "genre_requirement_met": true },
  "content_analysis": [
    { "prompt": "Thema 1", "ts_quote": "Exaktes Zitat TS", "sp_quotes": ["Exaktes Zitat SP 1", "Exaktes Zitat SP 2"], "rating": "F" }
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
        let input = document.getElementById('jsonInput').value;
        
        input = input.replace(/\u00A0/g, ' '); 
        input = input.replace(/[\u200B-\u200D\uFEFF]/g, '');

        const startIndex = input.indexOf('{');
        const endIndex = input.lastIndexOf('}');
        
        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
            throw new Error("Es konnte keine { JSON } Klammerstruktur im Text gefunden werden.");
        }

        const cleanJsonString = input.substring(startIndex, endIndex + 1);
        
        rawData = JSON.parse(cleanJsonString);

        if (!rawData) rawData = {};

        buildMarkedText();
        buildWizardPanels();
        
        document.getElementById('loop-controls').style.display = 'none';
        document.getElementById('btn-export').style.display = 'block';
        goToStep(1);
        navTo('screen-4');
    } catch (e) {
        alert("Fehler beim Auslesen des JSON. Bitte prüfe den Output der KI.\n\nTechnischer Grund: " + e.message);
    }
}

function makeFlexibleRegex(str) {
    if (typeof str !== 'string' || !str) return "";
    str = str.replace(/[.,!?]+$/, "");
    let escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(/\s+/g, '\\s+');
    return escaped + "[.,!?]*";
}

function buildMarkedText() {
    let text = document.getElementById('studentText').value || "";

    if(Array.isArray(rawData?.content_analysis)) {
        rawData.content_analysis.forEach(ca => {
            if(!ca) return;
            let ts = ca.ts_quote || ca.topic_sentence_quote || "";
            if(ts.trim() !== "") {
                let safeTS = makeFlexibleRegex(ts.trim());
                if(safeTS) text = text.replace(new RegExp(safeTS, 'gi'), `$&<sup class="hl-topic" data-export="color: #3498db; font-weight: bold;">0</sup>`);
            }
            if(Array.isArray(ca.sp_quotes)) {
                ca.sp_quotes.forEach((sp, i) => {
                    if(typeof sp === 'string' && sp.trim() !== "") {
                        let safeSP = makeFlexibleRegex(sp.trim());
                        if(safeSP) text = text.replace(new RegExp(safeSP, 'gi'), `$&<sup class="hl-topic" data-export="color: #3498db; font-weight: bold;">${i+1}</sup>`);
                    }
                });
            }
        });
    }

    if(Array.isArray(rawData?.language_structures?.complex_structures_quotes)) {
        rawData.language_structures.complex_structures_quotes.forEach(quote => {
            if(typeof quote === 'string' && quote.trim() !== "") {
                let safeQuote = makeFlexibleRegex(quote.trim());
                if(safeQuote) text = text.replace(new RegExp(safeQuote, 'gi'), `<span class="hl-complex" data-export="border-bottom: 2px solid #2ecc71;">$&</span>`);
            }
        });
    }

    if(Array.isArray(rawData?.language_structures?.linking_devices)) {
        rawData.language_structures.linking_devices.forEach(link => {
            if(typeof link === 'string' && link.trim() !== "") {
                let safeLink = makeFlexibleRegex(link.trim());
                if(safeLink) text = text.replace(new RegExp(`\\b${safeLink}\\b`, 'gi'), `<span class="hl-link" data-export="background-color: #a9dfbf; padding: 2px;">$&</span>`);
            }
        });
    }

    if(Array.isArray(rawData?.errors)) {
        rawData.errors.forEach(err => {
            if(err && typeof err.quote === 'string' && err.quote.trim() !== "") {
                let isGram = err.type === 'grammar';
                let cssClass = isGram ? 'hl-grammar' : 'hl-vocab';
                let expStyle = isGram ? 'background-color: #f5b7b1; padding: 2px;' : 'background-color: #fdebd0; padding: 2px;';
                
                let safeQuote = makeFlexibleRegex(err.quote.trim());
                if(safeQuote) text = text.replace(new RegExp(safeQuote, 'gi'), `<span class="${cssClass}" data-export="${expStyle}">$&</span>`);
            }
        });
    }

    document.getElementById('markedTextDisplay').innerHTML = text;
}

function buildWizardPanels() {
    let cHtml = "<table style='width:100%; font-size:0.9em; text-align:left;'><tr><th>Prompt</th><th>Rating</th></tr>";
    if(Array.isArray(rawData?.content_analysis)) {
        rawData.content_analysis.forEach(ca => {
            if(!ca) return;
            cHtml += `<tr><td style='border-bottom:1px solid #444; padding:5px;'>${ca.prompt || '?'}</td><td style='border-bottom:1px solid #444; padding:5px; color:var(--secondary); font-weight:bold;'>${ca.rating || '-'}</td></tr>`;
        });
    }
    cHtml += "</table>";
    document.getElementById('contentMatrix').innerHTML = cHtml;

    document.getElementById('linkingList').innerText = Array.isArray(rawData?.language_structures?.linking_devices) ? rawData.language_structures.linking_devices.join(', ') : '';
    document.getElementById('complexList').innerText = Array.isArray(rawData?.language_structures?.complex_structures_quotes) ? rawData.language_structures.complex_structures_quotes.join(', ') : '';

    let gramHtml = "", vocHtml = "";
    if(Array.isArray(rawData?.errors)) {
        rawData.errors.forEach((err, i) => {
            if(!err) return;
            let card = `
                <div class="card" id="err-${i}">
                    <div>
                        <div><s>${err.quote || ''}</s> &rarr; <b style="color:var(--success)">${err.correction || ''}</b></div>
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

    // --- FORMALITIES & NEUE GENRE LOGIK ---
    let fHtml = "";
    if(rawData?.formalities) {
        fHtml += `<li>Salutation: ${rawData.formalities.salutation_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Closing: ${rawData.formalities.closing_present ? '✅' : '❌'}</li>`;
        fHtml += `<li>Paragraphing: ${rawData.formalities.paragraphs_correct ? '✅' : '❌'}</li>`;
        
        const textType = document.getElementById('textType').value;
        const subType = document.getElementById('subType').value;
        
        if (textType === 'letter' && (subType === 'complaint' || subType === 'application')) {
            let reqName = subType === 'complaint' ? 'Demand for action' : 'Offer for interview';
            let reqMet = rawData.formalities.genre_requirement_met === true;
            let icon = reqMet ? '✅' : '❌';
            fHtml += `<li>Genre Requirement (${reqName}): ${icon}</li>`;
        }
    }
    document.getElementById('formalChecklist').innerHTML = fHtml || '<p>Keine Formalien-Daten gefunden.</p>';

    // --- SCOREBOARD & PUNKTE-SPERRE ---
    let maxGi = 2;
    let giReasoning = rawData?.scores?.reasoning?.gi || '';
    
    const textType = document.getElementById('textType').value;
    const subType = document.getElementById('subType').value;
    
    if (textType === 'letter' && (subType === 'complaint' || subType === 'application')) {
        if (rawData?.formalities?.genre_requirement_met === false) {
            maxGi = 1; 
            giReasoning = "⚠️ Max 1 Punkt (Forderung/Interview-Angebot fehlt!). " + giReasoning;
        }
    }

    document.getElementById('maxGiDisplay').innerText = maxGi;
    document.getElementById('score-content').value = Math.min(rawData?.scores?.content || 0, 7);
    document.getElementById('score-coherence').value = Math.min(rawData?.scores?.coherence || 0, 7);
    document.getElementById('score-grammar').value = Math.min(rawData?.scores?.grammar || 0, 7);
    document.getElementById('score-vocab').value = Math.min(rawData?.scores?.vocab || 0, 7);
    
    let giInput = document.getElementById('score-gi');
    giInput.max = maxGi;
    giInput.value = Math.min(rawData?.scores?.gi || 0, maxGi);
    
    document.getElementById('reason-content').value = rawData?.scores?.reasoning?.content || '';
    document.getElementById('reason-coherence').value = rawData?.scores?.reasoning?.coherence || '';
    document.getElementById('reason-grammar').value = rawData?.scores?.reasoning?.grammar || '';
    document.getElementById('reason-vocab').value = rawData?.scores?.reasoning?.vocab || '';
    document.getElementById('reason-gi').value = giReasoning;
}

function deleteError(i) {
    if(rawData && rawData.errors) {
        rawData.errors[i] = null;
        document.getElementById(`err-${i}`).remove();
        buildMarkedText(); 
    }
}

// --- EXPORT (Word Dokument) ---
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
    if(Array.isArray(rawData?.content_analysis)) {
        rawData.content_analysis.forEach(ca => {
            if(!ca) return;
            let spCount = Array.isArray(ca.sp_quotes) ? ca.sp_quotes.length : 0;
            let tsFound = (ca.ts_quote || ca.topic_sentence_quote) ? "Yes" : "No";
            cRows += `<tr><td>${ca.prompt || ''}</td><td>${tsFound}</td><td>${spCount}</td><td><b>${ca.rating || ''}</b></td></tr>`;
        });
    }

    let gRows = "", vRows = "";
    if(Array.isArray(rawData?.errors)) {
        rawData.errors.forEach(err => {
            if(!err) return;
            let row = `<tr><td><s>${err.quote || ''}</s></td><td>${err.correction || ''}</td><td>${err.explanation || ''}</td></tr>`;
            if(err.type === 'grammar') gRows += row;
            else vRows += row;
        });
    }

    const linking = Array.isArray(rawData?.language_structures?.linking_devices) ? rawData.language_structures.linking_devices.join(', ') : '';
    
    let textHTML = document.getElementById('markedTextDisplay').innerHTML;
    textHTML = textHTML.replace(/\n/g, '<br><br>');
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
