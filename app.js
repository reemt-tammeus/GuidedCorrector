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

// --- PROMPT BRÜCKE (INKL. NEEDS_REVIEW FLAG) ---
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
1. ZITATE & SPLITTING: Verändere den Originaltext NIEMALS. Zitiere den Topic Sentence ("ts_quote"). Splitte weitere inhaltliche Aussagen, Ursachen oder Folgen zwingend in SEPARATE Zitate auf ("sp_quotes"). WICHTIG: Jeder SP muss in der Regel in einem eigenen Satz stehen.
2. RATING (F/E/I/N) - EXAKTE VORGABE: Du bewertest AUSSCHLIESSLICH nach der Anzahl der gefundenen Elemente:
   F = Topic Sentence ("ts_quote") UND mindestens 2 Zitate in "sp_quotes" vorhanden.
   E = Topic Sentence ("ts_quote") UND exakt 1 Zitat in "sp_quotes" vorhanden.
   I = Topic Sentence ("ts_quote") vorhanden, ABER "sp_quotes" ist leer (0 SPs).
   N = Weder Topic Sentence noch Supporting Points vorhanden.
3. UNSICHERHEIT ("needs_review"): Wenn du dir bei der Bewertung unsicher bist ODER wenn ein Schüler mehrere wichtige Gedanken in einem einzigen, langen Bandwurmsatz verpackt hat (den du laut strenger Regelung evtl. abwerten müsstest), setze zwingend den Wert "needs_review": true für diesen Prompt.
4. PUNKTE: Die finale Punktzahl (0-7) berechnet die App selbst aus der F/E/I/N-Matrix. Gib einfach einen Schätzwert an.
5. WEITERE SCORES: Halte dich an diese Maximalwerte: coherence (max 7), grammar (max 7), vocab (max 7), gi (max 2).${genreInstruction}

Erzeuge AUSSCHLIESSLICH dieses JSON-Format als Antwort:
{
  "formalities": { "salutation_present": true, "closing_present": true, "paragraphs_correct": true, "genre_requirement_met": true },
  "content_analysis": [
    { "prompt": "Thema 1", "ts_quote": "Exaktes Zitat TS", "sp_quotes": ["Exaktes Zitat SP 1", "Exaktes Zitat SP 2"], "rating": "F", "needs_review": true }
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

        calculateInitialContentScore();

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

// --- ZENTRALE MATH-LOGIK FÜR DIE MATRIX ---
function getScoreFromRatings(f, e, i, n) {
    let score = 0;
    if (f === 4) score = 7;
    else if (f === 3 && e === 1) score = 7;
    else if (f === 3 && i === 1) score = 6;
    else if (f === 2 && e === 2) score = 6;
    else if (f === 1 && e === 3) score = 6;
    else if (f === 2 && e === 1 && i === 1) score = 6;
    else if (f === 3 && n === 1) score = 5;
    else if (e === 4) score = 5;
    else if (e === 3 && i === 1) score = 5;
    else if (f === 2 && i === 2) score = 5;
    else if (f === 2 && e === 1 && n === 1) score = 5;
    else if (f === 1 && e === 2 && i === 1) score = 5;
    else if (e === 3 && n === 1) score = 4;
    else if (e === 2 && i === 2) score = 4;
    else if (f === 1 && e === 1 && i === 2) score = 4;
    else if (f === 2 && i === 1 && n === 1) score = 4;
    else if (f === 1 && e === 2 && n === 1) score = 4;
    else if (e === 2 && i === 1 && n === 1) score = 3;
    else if (i === 4) score = 3;
    else if (i === 3 && e === 1) score = 3;
    else if (f === 1 && e === 1 && i === 1 && n === 1) score = 3;
    else if (f === 1 && i === 3) score = 3;
    else if (f === 2 && n === 2) score = 3;
    else if (i === 3 && n === 1) score = 2;
    else if (i === 2 && e === 1 && n === 1) score = 2;
    else if (e === 2 && n === 2) score = 2;
    else if (f === 1 && i === 2 && n === 1) score = 2;
    else if (e === 1 && i === 2 && n === 1) score = 2;
    else if (f === 1 && n === 3) score = 1;
    else if (e === 1 && n === 3) score = 1;
    else if (i === 1 && n === 3) score = 1;
    else if (i === 2 && n === 2) score = 1;
    else if (n === 4) score = 0;
    return score;
}

function calculateInitialContentScore() {
    if (!rawData || !rawData.content_analysis) return;
    let f = 0, e = 0, i = 0, n = 0;
    rawData.content_analysis.forEach(ca => {
        if (ca.rating === 'F') f++;
        if (ca.rating === 'E') e++;
        if (ca.rating === 'I') i++;
        if (ca.rating === 'N') n++;
    });
    
    let score = getScoreFromRatings(f, e, i, n);

    if (!rawData.scores) rawData.scores = {};
    rawData.scores.content = score;
    if (!rawData.scores.reasoning) rawData.scores.reasoning = {};
    rawData.scores.reasoning.content = `Auto-Kalkulation: Das Raster (${f}xF, ${e}xE, ${i}xI, ${n}xN) ergibt streng nach Regelwerk exakt ${score} Punkte.`;
}

// --- DYNAMISCHE NEUBERECHNUNG DURCH DROPDOWNS ---
function recalculateContentFromDropdowns() {
    if (!rawData || !rawData.content_analysis) return;
    let f = 0, e = 0, i = 0, n = 0;
    
    rawData.content_analysis.forEach((ca, idx) => {
        let val = document.getElementById(`rating-dropdown-${idx}`).value;
        ca.rating = val; // Überschreibt die Rohdaten für den Export
        if(val === 'F') f++;
        if(val === 'E') e++;
        if(val === 'I') i++;
        if(val === 'N') n++;
    });

    let score = getScoreFromRatings(f, e, i, n);
    
    document.getElementById('score-content').value = score;
    document.getElementById('reason-content').value = `Manuell angepasst: Das Raster (${f}xF, ${e}xE, ${i}xI, ${n}xN) ergibt nach Matrix exakt ${score} Punkte.`;
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
    let needsReviewGlobal = false;
    let cHtml = "<table style='width:100%; font-size:0.9em; text-align:left;'><tr><th>Prompt</th><th>Rating</th></tr>";
    
    if(Array.isArray(rawData?.content_analysis)) {
        rawData.content_analysis.forEach((ca, idx) => {
            if(!ca) return;
            
            // Check für Rosa-Markierung
            if(ca.needs_review === true) needsReviewGlobal = true;
            let titleColor = ca.needs_review ? "color: #ff69b4; font-weight: bold;" : "color: var(--text-light);";

            // Dynamisches Dropdown-Menü
            let selectHtml = `<select id="rating-dropdown-${idx}" onchange="recalculateContentFromDropdowns()" style="background: rgba(0,0,0,0.3); border: 1px solid #444; color: var(--secondary); font-weight: bold; padding: 2px; border-radius: 4px; cursor: pointer;">
                <option value="F" ${ca.rating==='F'?'selected':''}>F</option>
                <option value="E" ${ca.rating==='E'?'selected':''}>E</option>
                <option value="I" ${ca.rating==='I'?'selected':''}>I</option>
                <option value="N" ${ca.rating==='N'?'selected':''}>N</option>
            </select>`;

            cHtml += `<tr><td style='border-bottom:1px solid #444; padding:8px; ${titleColor}'>${ca.prompt || '?'}</td><td style='border-bottom:1px solid #444; padding:8px;'>${selectHtml}</td></tr>`;
        });
    }
    cHtml += "</table>";

    // Einfügen der rosa Warnmeldung falls nötig
    if (needsReviewGlobal) {
        cHtml += `<div style="color: #ff69b4; font-weight: bold; margin-top: 15px; font-size: 0.9em; background: rgba(255, 105, 180, 0.1); padding: 10px; border-radius: 4px;">⚠️ Bei diesen rosa markierten Content Points (CP) bin ich mir bei der Bewertung nicht sicher. Bitte kontrolliere sie nochmal.</div>`;
    }

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
