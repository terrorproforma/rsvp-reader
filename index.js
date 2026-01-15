/**
 * RSVP Speed Reader Application
 * 
 * Features:
 * - Rapid Serial Visual Presentation with ORP (Optimal Recognition Point)
 * - Adjustable WPM (words per minute)
 * - Notes saving with localStorage persistence
 * - Keyboard shortcuts for hands-free control
 */

// ================================
// STATE
// ================================

const state = {
  text: '',
  words: [],
  currentIndex: 0,
  wpm: 300,
  isPlaying: false,
  isSeeking: false,
  intervalId: null,
  notes: [],
  orpAlignment: 'left', // 'left', 'center', 'right'
  pauseMultipliers: {
    period: 2.0,   // . ! ?
    comma: 1.25,   // ,
    colon: 1.5     // : ;
  }
};

// ================================
// DOM ELEMENTS
// ================================

const elements = {
  // Views
  inputView: document.getElementById('input-view'),
  notesView: document.getElementById('notes-view'),
  readerView: document.getElementById('reader-view'),

  // Input
  textInput: document.getElementById('text-input'),
  fileInput: document.getElementById('file-input'),
  wordCount: document.getElementById('word-count'),
  readingTime: document.getElementById('reading-time'),
  wpmSlider: document.getElementById('wpm-slider'),
  wpmDisplay: document.getElementById('wpm-display'),
  alignmentBtns: document.querySelectorAll('.alignment-btn'),
  readerAlignBtns: document.querySelectorAll('.reader-align-btn'),

  // Pause settings
  pausePeriodSlider: document.getElementById('pause-period'),
  pausePeriodValue: document.getElementById('pause-period-value'),
  pauseCommaSlider: document.getElementById('pause-comma'),
  pauseCommaValue: document.getElementById('pause-comma-value'),
  pauseColonSlider: document.getElementById('pause-colon'),
  pauseColonValue: document.getElementById('pause-colon-value'),

  // Buttons
  startBtn: document.getElementById('start-btn'),
  saveBtn: document.getElementById('save-btn'),
  exitBtn: document.getElementById('exit-btn'),
  playPauseBtn: document.getElementById('play-pause-btn'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),

  // Reader
  wordContainer: document.getElementById('word-container'),
  wordBefore: document.getElementById('word-before'),
  wordOrp: document.getElementById('word-orp'),
  wordAfter: document.getElementById('word-after'),
  progressFill: document.getElementById('progress-fill'),
  progressBar: document.getElementById('progress-bar'),
  progressText: document.getElementById('progress-text'),
  timeRemaining: document.getElementById('time-remaining'),
  readerWpm: document.getElementById('reader-wpm'),
  readerWpmSlider: document.getElementById('reader-wpm-slider'),

  // Notes
  notesList: document.getElementById('notes-list'),
  emptyState: document.getElementById('empty-state'),

  // Modal
  saveModal: document.getElementById('save-modal'),
  noteTitle: document.getElementById('note-title'),
  cancelSaveBtn: document.getElementById('cancel-save-btn'),
  confirmSaveBtn: document.getElementById('confirm-save-btn'),

  // Nav tabs
  navTabs: document.querySelectorAll('.nav-tab')
};

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Calculate the Optimal Recognition Point (ORP) for a word
 * The ORP is typically around 35% into the word, slightly left of center
 */
function getORPIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 1;
  if (len <= 5) return 1;
  if (len <= 9) return Math.floor(len * 0.35);
  return Math.floor(len * 0.35);
}

/**
 * Render a word with the ORP character highlighted
 */
function renderWordWithORP(word) {
  if (!word) return '';

  const orpIndex = getORPIndex(word);
  const before = word.substring(0, orpIndex);
  const orp = word.charAt(orpIndex);
  const after = word.substring(orpIndex + 1);

  return `${before}<span class="orp">${orp}</span>${after}`;
}

/**
 * Parse text into words
 */
function parseText(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Format time in minutes and seconds
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(wordCount, wpm) {
  return Math.ceil(wordCount / wpm);
}

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ================================
// STORAGE
// ================================

const storage = {
  NOTES_KEY: 'rsvp_notes',

  loadNotes() {
    try {
      const data = localStorage.getItem(this.NOTES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load notes:', e);
      return [];
    }
  },

  saveNotes(notes) {
    try {
      localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  }
};

// ================================
// VIEW MANAGEMENT
// ================================

function showView(viewName) {
  // Hide all views
  elements.inputView.classList.remove('active');
  elements.notesView.classList.remove('active');
  elements.readerView.classList.remove('active');

  // Show requested view
  switch (viewName) {
    case 'input':
      elements.inputView.classList.add('active');
      break;
    case 'notes':
      elements.notesView.classList.add('active');
      renderNotesList();
      break;
    case 'reader':
      elements.readerView.classList.add('active');
      break;
  }

  // Update nav tabs
  elements.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
}

// ================================
// INPUT HANDLERS
// ================================

function handleTextInput() {
  const text = elements.textInput.value;
  state.text = text;
  state.words = parseText(text);

  // Update word count and reading time
  const count = state.words.length;
  elements.wordCount.textContent = count;
  elements.readingTime.textContent = calculateReadingTime(count, state.wpm);
}

function handleWpmChange() {
  state.wpm = parseInt(elements.wpmSlider.value);
  elements.wpmDisplay.textContent = `${state.wpm} wpm`;
  elements.readerWpm.textContent = `${state.wpm} wpm`;
  elements.readerWpmSlider.value = state.wpm;

  // Update reading time
  elements.readingTime.textContent = calculateReadingTime(state.words.length, state.wpm);

  // If playing, restart with new speed
  if (state.isPlaying) {
    stopReading();
    startReading();
  }
}

function handleReaderWpmChange() {
  state.wpm = parseInt(elements.readerWpmSlider.value);
  elements.readerWpm.textContent = `${state.wpm} wpm`;
  elements.wpmSlider.value = state.wpm;
  elements.wpmDisplay.textContent = `${state.wpm} wpm`;

  // Update reading time
  elements.readingTime.textContent = calculateReadingTime(state.words.length, state.wpm);
  updateProgress();

  // If playing, restart with new speed
  if (state.isPlaying) {
    stopReading();
    startReading();
  }
}

// ================================
// READER CONTROLS
// ================================

function startReading() {
  if (state.words.length === 0) return;

  state.isPlaying = true;
  elements.playPauseBtn.innerHTML = '⏸';

  scheduleNextWord();
}

function scheduleNextWord() {
  if (!state.isPlaying) return;

  if (state.currentIndex >= state.words.length) {
    stopReading();
    return;
  }

  displayCurrentWord();
  const word = state.words[state.currentIndex];
  state.currentIndex++;
  updateProgress();

  // Calculate delay with punctuation pauses
  const baseInterval = (60 / state.wpm) * 1000;
  const delay = baseInterval * getPunctuationMultiplier(word);

  state.intervalId = setTimeout(scheduleNextWord, delay);
}

function getPunctuationMultiplier(word) {
  if (!word) return 1;
  const lastChar = word.slice(-1);

  // Longer pause for sentence endings (. ! ?)
  if ('.!?'.includes(lastChar)) return state.pauseMultipliers.period;

  // Medium pause for major breaks (: ;)
  if (':;'.includes(lastChar)) return state.pauseMultipliers.colon;

  // Slight pause for minor breaks (,)
  if (','.includes(lastChar)) return state.pauseMultipliers.comma;

  // Pause for dashes and ellipsis
  if (word.endsWith('—') || word.endsWith('...') || word.endsWith('–')) return state.pauseMultipliers.colon;

  return 1;
}

function stopReading() {
  state.isPlaying = false;
  elements.playPauseBtn.innerHTML = '▶';

  if (state.intervalId) {
    clearTimeout(state.intervalId);
    state.intervalId = null;
  }
}

function togglePlayPause() {
  if (state.isPlaying) {
    stopReading();
  } else {
    // Reset if at end
    if (state.currentIndex >= state.words.length) {
      state.currentIndex = 0;
    }
    startReading();
  }
}

function displayCurrentWord() {
  const word = state.words[state.currentIndex];
  if (word) {
    const orpIndex = getORPIndex(word);
    const before = word.substring(0, orpIndex);
    const orp = word.charAt(orpIndex);
    const after = word.substring(orpIndex + 1);

    // Update the three word spans
    elements.wordBefore.textContent = before;
    elements.wordOrp.textContent = orp;
    elements.wordAfter.textContent = after;

    // Calculate offset based on alignment mode
    // - left: left edge of ORP at center
    // - center: center of ORP at center
    // - right: right edge of ORP at center
    requestAnimationFrame(() => {
      const beforeWidth = elements.wordBefore.offsetWidth;
      const orpWidth = elements.wordOrp.offsetWidth;
      const afterWidth = elements.wordAfter.offsetWidth;
      const totalWidth = beforeWidth + orpWidth + afterWidth;
      const containerCenter = totalWidth / 2;

      let offset;
      switch (state.orpAlignment) {
        case 'left':
          // Left edge of ORP at center line
          offset = beforeWidth - containerCenter;
          break;
        case 'center':
          // Center of ORP at center line
          offset = (beforeWidth + orpWidth / 2) - containerCenter;
          break;
        case 'right':
          // Right edge of ORP at center line
          offset = (beforeWidth + orpWidth) - containerCenter;
          break;
        default:
          offset = beforeWidth - containerCenter;
      }

      elements.wordContainer.style.transform = `translateX(${-offset}px)`;
    });
  }
}

function updateProgress() {
  const total = state.words.length;
  const current = state.currentIndex;
  const percent = total > 0 ? (current / total) * 100 : 0;

  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = `${current} / ${total} words`;

  // Calculate remaining time
  const remainingWords = total - current;
  const remainingSeconds = (remainingWords / state.wpm) * 60;
  elements.timeRemaining.textContent = `${formatTime(remainingSeconds)} remaining`;
}

function goToPrevWord() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    displayCurrentWord();
    updateProgress();
  }
}

function goToNextWord() {
  if (state.currentIndex < state.words.length - 1) {
    state.currentIndex++;
    displayCurrentWord();
    updateProgress();
  }
}

function adjustSpeed(delta) {
  const newWpm = Math.max(100, Math.min(1000, state.wpm + delta));
  state.wpm = newWpm;
  elements.wpmSlider.value = newWpm;
  elements.wpmDisplay.textContent = `${newWpm} wpm`;
  elements.readerWpm.textContent = `${newWpm} wpm`;

  // Restart if playing
  if (state.isPlaying) {
    stopReading();
    startReading();
  }
}

// Progress bar seeking
function seekToPosition(e) {
  const bar = elements.progressBar;
  const rect = bar.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, x / rect.width));
  const newIndex = Math.floor(percent * state.words.length);

  state.currentIndex = Math.min(newIndex, state.words.length - 1);
  displayCurrentWord();
  updateProgress();
}

function handleProgressMouseDown(e) {
  state.isSeeking = true;
  seekToPosition(e);

  document.addEventListener('mousemove', handleProgressMouseMove);
  document.addEventListener('mouseup', handleProgressMouseUp);
}

function handleProgressMouseMove(e) {
  if (state.isSeeking) {
    seekToPosition(e);
  }
}

function handleProgressMouseUp() {
  state.isSeeking = false;
  document.removeEventListener('mousemove', handleProgressMouseMove);
  document.removeEventListener('mouseup', handleProgressMouseUp);
}

// Touch event handlers for mobile
function handleProgressTouchStart(e) {
  e.preventDefault();
  state.isSeeking = true;
  seekToPositionFromTouch(e);
}

function handleProgressTouchMove(e) {
  if (state.isSeeking) {
    e.preventDefault();
    seekToPositionFromTouch(e);
  }
}

function handleProgressTouchEnd() {
  state.isSeeking = false;
}

function seekToPositionFromTouch(e) {
  const touch = e.touches[0];
  const bar = elements.progressBar;
  const rect = bar.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, x / rect.width));
  const newIndex = Math.floor(percent * state.words.length);

  state.currentIndex = Math.min(newIndex, state.words.length - 1);
  displayCurrentWord();
  updateProgress();
}

function enterReader() {
  if (state.words.length === 0) {
    alert('Please enter some text first!');
    return;
  }

  state.currentIndex = 0;

  // Sync reader slider with current WPM
  elements.readerWpmSlider.value = state.wpm;
  elements.readerWpm.textContent = `${state.wpm} wpm`;

  // Sync reader alignment buttons with current alignment
  elements.readerAlignBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.align === state.orpAlignment);
  });

  displayCurrentWord();
  updateProgress();
  showView('reader');

  // Auto-play when entering reader
  startReading();
}

function exitReader() {
  stopReading();
  showView('input');
}

// ================================
// NOTES MANAGEMENT
// ================================

function saveNote() {
  const title = elements.noteTitle.value.trim();
  const content = state.text.trim();

  if (!title || !content) {
    alert('Please enter both a title and some text.');
    return;
  }

  const note = {
    id: generateId(),
    title,
    content,
    wordCount: state.words.length,
    createdAt: Date.now(),
    lastReadAt: null,
    lastPosition: 0
  };

  state.notes.unshift(note);
  storage.saveNotes(state.notes);

  closeModal();
  elements.noteTitle.value = '';

  // Show success feedback
  elements.saveBtn.textContent = '✓ Saved!';
  setTimeout(() => {
    elements.saveBtn.innerHTML = '💾 Save as Note';
  }, 2000);
}

function loadNote(noteId) {
  // Convert to number since dataset values are strings
  const id = Number(noteId);
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  elements.textInput.value = note.content;
  handleTextInput();
  showView('input');

  // Update last read time
  note.lastReadAt = Date.now();
  storage.saveNotes(state.notes);
}

function deleteNote(noteId) {
  if (!confirm('Delete this note?')) return;

  // Convert to number since dataset values are strings
  const id = Number(noteId);
  state.notes = state.notes.filter(n => n.id !== id);
  storage.saveNotes(state.notes);
  renderNotesList();
}

function renderNotesList() {
  if (state.notes.length === 0) {
    elements.notesList.innerHTML = '';
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.emptyState.style.display = 'none';

  elements.notesList.innerHTML = state.notes.map(note => `
    <div class="note-card">
      <div class="note-content" data-id="${note.id}">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-preview">${escapeHtml(note.content.substring(0, 150))}${note.content.length > 150 ? '...' : ''}</div>
        <div class="note-meta">
          ${note.wordCount} words · ${formatDate(note.createdAt)}
        </div>
      </div>
      <button class="btn btn-ghost btn-icon note-delete" data-id="${note.id}" title="Delete note">
        🗑️
      </button>
    </div>
  `).join('');

  // Add click handlers
  elements.notesList.querySelectorAll('.note-content').forEach(el => {
    el.addEventListener('click', () => loadNote(el.dataset.id));
  });

  elements.notesList.querySelectorAll('.note-delete').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(el.dataset.id);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}

// ================================
// MODAL
// ================================

function openModal() {
  if (!state.text.trim()) {
    alert('Please enter some text first!');
    return;
  }

  // Generate default title from first few words
  const firstWords = state.words.slice(0, 5).join(' ');
  elements.noteTitle.value = firstWords + (state.words.length > 5 ? '...' : '');

  elements.saveModal.classList.add('active');
  elements.noteTitle.focus();
  elements.noteTitle.select();
}

function closeModal() {
  elements.saveModal.classList.remove('active');
}

// ================================
// KEYBOARD SHORTCUTS
// ================================

function handleKeyboard(e) {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }

  // Reader view shortcuts
  if (elements.readerView.classList.contains('active')) {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          adjustSpeed(-50);
        } else {
          goToPrevWord();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          adjustSpeed(50);
        } else {
          goToNextWord();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        adjustSpeed(25);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustSpeed(-25);
        break;
      case 'Escape':
        exitReader();
        break;
    }
  }

  // Modal shortcuts
  if (elements.saveModal.classList.contains('active')) {
    if (e.key === 'Escape') {
      closeModal();
    }
  }
}

// ================================
// FILE HANDLING
// ================================

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (file) {
    readTextFile(file);
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.textInput.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.textInput.classList.remove('drag-over');
}

function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  elements.textInput.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      readTextFile(file);
    } else {
      alert('Please drop a .txt file');
    }
  }
}

function readTextFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    elements.textInput.value = e.target.result;
    handleTextInput();
  };
  reader.onerror = () => {
    alert('Error reading file');
  };
  reader.readAsText(file);
}

// ================================
// EVENT LISTENERS
// ================================

function initEventListeners() {
  // Text input
  elements.textInput.addEventListener('input', handleTextInput);

  // File upload
  elements.fileInput.addEventListener('change', handleFileUpload);

  // Drag and drop on textarea
  elements.textInput.addEventListener('dragover', handleDragOver);
  elements.textInput.addEventListener('dragleave', handleDragLeave);
  elements.textInput.addEventListener('drop', handleFileDrop);

  // WPM slider (input view)
  elements.wpmSlider.addEventListener('input', handleWpmChange);

  // Pause settings sliders
  elements.pausePeriodSlider.addEventListener('input', () => {
    state.pauseMultipliers.period = parseFloat(elements.pausePeriodSlider.value);
    elements.pausePeriodValue.textContent = `${state.pauseMultipliers.period.toFixed(2)}×`;
  });

  elements.pauseCommaSlider.addEventListener('input', () => {
    state.pauseMultipliers.comma = parseFloat(elements.pauseCommaSlider.value);
    elements.pauseCommaValue.textContent = `${state.pauseMultipliers.comma.toFixed(2)}×`;
  });

  elements.pauseColonSlider.addEventListener('input', () => {
    state.pauseMultipliers.colon = parseFloat(elements.pauseColonSlider.value);
    elements.pauseColonValue.textContent = `${state.pauseMultipliers.colon.toFixed(2)}×`;
  });

  // Alignment buttons (input view)
  elements.alignmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update state
      state.orpAlignment = btn.dataset.align;

      // Update active class on both button sets
      elements.alignmentBtns.forEach(b => b.classList.remove('active'));
      elements.readerAlignBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Also activate matching reader button
      elements.readerAlignBtns.forEach(b => {
        if (b.dataset.align === btn.dataset.align) b.classList.add('active');
      });

      // If in reader, update display
      if (state.words.length > 0) {
        displayCurrentWord();
      }
    });
  });

  // Reader alignment buttons (syncs with input view)
  elements.readerAlignBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update state
      state.orpAlignment = btn.dataset.align;

      // Update active class on both button sets
      elements.alignmentBtns.forEach(b => b.classList.remove('active'));
      elements.readerAlignBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Also activate matching input button
      elements.alignmentBtns.forEach(b => {
        if (b.dataset.align === btn.dataset.align) b.classList.add('active');
      });

      // Update display immediately
      displayCurrentWord();
    });
  });

  // Reader WPM slider (syncs with main slider)
  elements.readerWpmSlider.addEventListener('input', handleReaderWpmChange);

  // Progress bar seeking (mouse and touch)
  elements.progressBar.addEventListener('mousedown', handleProgressMouseDown);
  elements.progressBar.addEventListener('touchstart', handleProgressTouchStart, { passive: false });
  elements.progressBar.addEventListener('touchmove', handleProgressTouchMove, { passive: false });
  elements.progressBar.addEventListener('touchend', handleProgressTouchEnd);

  // Nav tabs
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });

  // Buttons
  elements.startBtn.addEventListener('click', enterReader);
  elements.saveBtn.addEventListener('click', openModal);
  elements.exitBtn.addEventListener('click', exitReader);
  elements.playPauseBtn.addEventListener('click', togglePlayPause);
  elements.prevBtn.addEventListener('click', goToPrevWord);
  elements.nextBtn.addEventListener('click', goToNextWord);

  // Modal
  elements.cancelSaveBtn.addEventListener('click', closeModal);
  elements.confirmSaveBtn.addEventListener('click', saveNote);
  elements.saveModal.addEventListener('click', (e) => {
    if (e.target === elements.saveModal) closeModal();
  });

  // Keyboard
  document.addEventListener('keydown', handleKeyboard);
}

// ================================
// INITIALIZATION
// ================================

function init() {
  // Load saved notes
  state.notes = storage.loadNotes();

  // Initialize event listeners
  initEventListeners();

  // Set initial WPM display
  elements.wpmDisplay.textContent = `${state.wpm} wpm`;
  elements.readerWpm.textContent = `${state.wpm} wpm`;

  // Add sample note for first-time users (Accelerando excerpt)
  if (state.notes.length === 0) {
    const sampleNote = {
      id: Date.now(),
      title: 'Accelerando - Chapter 1 (Sample)',
      content: `Manfred's on the road again, making strangers rich. It's a hot summer Tuesday, and he's standing in the plaza in front of the Centraal Station with his eyeballs powered up and the sunlight jangling off the canal, motor scooters and kamikaze cyclists whizzing past and tourists chattering on every side. The square smells of water and dirt and hot metal and the fart-laden exhaust fumes of cold catalytic converters; the bells of trams ding in the background, and birds flock overhead. He glances up and grabs a pigeon, crops the shot, and squirts it at his weblog to show he's arrived. The bandwidth is good here, he realizes; and it's not just the bandwidth, it's the whole scene. Amsterdam is making him feel wanted already, even though he's fresh off the train from Schiphol: He's infected with the dynamic optimism of another time zone, another city. If the mood holds, someone out there is going to become very rich indeed. He wonders who it's going to be.

Manfred sits on a stool out in the car park at the Brouwerij 't IJ, watching the articulated buses go by and drinking a third of a liter of lip-curlingly sour gueuze. His channels are jabbering away in a corner of his head-up display, throwing compressed infobursts of filtered press releases at him. They compete for his attention, bickering and rudely waving in front of the scenery. A couple of punks – maybe local, but more likely drifters lured to Amsterdam by the magnetic field of tolerance the Dutch beam across Europe like a pulsar – are laughing and chatting by a couple of battered mopeds in the far corner. A tourist boat putters by in the canal; the sails of the huge windmill overhead cast long, cool shadows across the road.

Welcome to the twenty-first century. The permanent floating meatspace party Manfred is hooking up with is a strange attractor for some of the American exiles cluttering up the cities of Europe this decade – not trustafarians, but honest-to-God political dissidents, draft dodgers, and terminal outsourcing victims. It's the kind of place where weird connections are made and crossed lines make new short circuits into the future.`,
      wordCount: 350,
      createdAt: new Date().toISOString()
    };

    state.notes.push(sampleNote);
    storage.saveNotes(state.notes);
    renderNotesList();

    // Also set the tutorial text in the input
    elements.textInput.value = `Welcome to RSVP Speed Reader! This technique helps you read faster by showing one word at a time in the center of your vision. The red letter is the Optimal Recognition Point, where your eye naturally focuses. Try adjusting the speed with the slider, then click Start Reading. Use Space to pause, and arrow keys to navigate. Happy speed reading!`;
    handleTextInput();
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
