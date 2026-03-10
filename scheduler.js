(function(){
  'use strict';

  const STORAGE_KEY = 'scheduler-state-v1';
  const PRESETS = {
    preflight: {
      endEvent: { name: 'Flight Takeoff', time: '' },
      activities: [
        { name: 'drive', minutes: 30 },
        { name: 'park', minutes: 20 },
        { name: 'check bags', minutes: 20 },
        { name: 'security', minutes: 20 },
        { name: 'walk to gate', minutes: 10 },
        { name: 'boarding', minutes: 40 }
      ]
    },
    dance: {
      endEvent: { name: 'Class Start', time: '5:15 PM' },
      activities: [
        { name: 'get dance bag', minutes: 10 },
        { name: 'make snack', minutes: 10 },
        { name: 'drive to school', minutes: 8 },
        { name: 'pick up and get changed', minutes: 10 },
        { name: 'drive to class', minutes: 10 }
      ]
    }
  };

  const safeStore = (()=>{
    const mem = Object.create(null);
    return {
      get(key){
        try{
          return (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : mem[key];
        }catch(e){
          return mem[key];
        }
      },
      set(key,val){
        try{
          if(typeof localStorage !== 'undefined'){
            localStorage.setItem(key,val);
          } else {
            mem[key] = val;
          }
        }catch(e){
          mem[key] = val;
        }
      }
    };
  })();

  let activities = [
    { name: 'Boarding', minutes: 40, fixed: false, fixedTime: '' },
    { name: 'Walking', minutes: 10, fixed: false, fixedTime: '' },
    { name: 'Security', minutes: 30, fixed: false, fixedTime: '' },
    { name: 'Check Bags', minutes: 15, fixed: false, fixedTime: '' }
  ];
  let endEvent = { name: 'Flight Takeoff', time: '' };

  let tbodyEl;
  let addBtnEl;
  let modeToggleEl;
  let presetPreflightBtnEl;
  let presetDanceBtnEl;
  let nameInputEl;
  let minutesInputEl;
  let formErrorEl;
  let mapFromEl;
  let mapToEl;
  let mapModeEl;
  let mapFrameEl;
  let mapErrorEl;
  let mapUpdateBtnEl;
  let mapOpenLinkEl;

  function showValidation(msg){
    if(formErrorEl){
      formErrorEl.textContent = msg || '';
    }
  }

  function setFieldError(input, msg){
    if(!input) return;
    input.classList.add('input-error');
    showValidation(msg);
  }

  function clearFieldError(input){
    if(!input) return;
    input.classList.remove('input-error');
  }

  function parseTimeInput(value){
    const raw = (value || '').toString().trim().toUpperCase().replace(/\s+/g, ' ');
    const match = raw.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/);
    if(!match) return null;
    const hours12 = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3];
    if(Number.isNaN(hours12) || hours12 < 1 || hours12 > 12 || Number.isNaN(minutes)) return null;
    const hours24 = (hours12 % 12) + (meridiem === 'PM' ? 12 : 0);
    return { hours24, minutes, normalized: format12Hour(hours24, minutes) };
  }

  function parse24Hour(value){
    const raw = (value || '').toString().trim();
    const match = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if(!match) return null;
    const hours24 = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if(Number.isNaN(hours24) || Number.isNaN(minutes)) return null;
    return { hours24, minutes };
  }

  function normalizeSavedTime(value){
    const parsed12 = parseTimeInput(value);
    if(parsed12) return parsed12.normalized;
    const parsed24 = parse24Hour(value);
    if(parsed24) return format12Hour(parsed24.hours24, parsed24.minutes);
    return '';
  }

  function format12Hour(hours24, minutes){
    const normalizedHours = ((hours24 % 24) + 24) % 24;
    const h = normalizedHours % 12 || 12;
    const m = String(minutes).padStart(2, '0');
    const ampm = normalizedHours >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  }

  function normalizeActivity(item){
    if(!item || typeof item !== 'object') return null;
    const name = (item.name || '').toString().trim();
    const minutes = parseInt(item.minutes, 10);
    if(!name || Number.isNaN(minutes) || minutes < 1) return null;
    const fixedTime = normalizeSavedTime(item.fixedTime || '');
    const fixed = typeof item.fixed === 'boolean' ? item.fixed : !!fixedTime;
    return { name, minutes, fixed, fixedTime };
  }

  function loadState(){
    const raw = safeStore.get(STORAGE_KEY);
    if(!raw) return;

    try{
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.activities)){
        const cleaned = parsed.activities.map(normalizeActivity).filter(Boolean);
        if(cleaned.length){
          activities = cleaned;
        }
      }
      if(parsed && parsed.endEvent && typeof parsed.endEvent === 'object'){
        const endName = (parsed.endEvent.name || '').toString();
        const endTime = (parsed.endEvent.time || '').toString();
        endEvent = {
          name: endName || 'Flight Takeoff',
          time: normalizeSavedTime(endTime)
        };
      }
    }catch(e){
      showValidation('Saved schedule data was invalid and was ignored.');
    }
  }

  function saveState(){
    safeStore.set(STORAGE_KEY, JSON.stringify({ activities, endEvent }));
  }

  function validateNewActivity(name, minutes){
    if(!name) return 'Activity name is required.';
    if(Number.isNaN(minutes) || minutes < 1) return 'Minutes must be a number greater than 0.';
    return '';
  }

  function addActivity(){
    const name = (nameInputEl && nameInputEl.value ? nameInputEl.value : '').trim();
    const mins = parseInt(minutesInputEl && minutesInputEl.value ? minutesInputEl.value : '', 10);
    const msg = validateNewActivity(name, mins);

    if(msg){
      showValidation(msg);
      if(!name && nameInputEl) setFieldError(nameInputEl, msg);
      if((Number.isNaN(mins) || mins < 1) && minutesInputEl) setFieldError(minutesInputEl, msg);
      return;
    }

    clearFieldError(nameInputEl);
    clearFieldError(minutesInputEl);
    showValidation('');

    activities.unshift({ name, minutes: mins, fixed: false, fixedTime: '' });
    if(nameInputEl) nameInputEl.value = '';
    if(minutesInputEl) minutesInputEl.value = '';

    saveState();
    render();
    calculate();
  }

  function buildMapUrls(from, to, mode){
    const safeMode = ['driving', 'walking', 'transit'].includes(mode) ? mode : 'driving';
    const qFrom = encodeURIComponent(from);
    const qTo = encodeURIComponent(to);
    const embedUrl = `https://www.google.com/maps?saddr=${qFrom}&daddr=${qTo}&dirflg=${safeMode.charAt(0)}&output=embed`;
    const openUrl = `https://www.google.com/maps/dir/?api=1&origin=${qFrom}&destination=${qTo}&travelmode=${safeMode}`;
    return { embedUrl, openUrl };
  }

  function clearMapValidation(){
    if(mapErrorEl) mapErrorEl.textContent = '';
    if(mapFromEl) mapFromEl.classList.remove('input-error');
    if(mapToEl) mapToEl.classList.remove('input-error');
  }

  function updateMap(){
    if(!mapFromEl || !mapToEl || !mapModeEl || !mapFrameEl || !mapOpenLinkEl) return;

    const from = (mapFromEl.value || '').trim();
    const to = (mapToEl.value || '').trim();
    const mode = mapModeEl.value;

    clearMapValidation();
    if(!from || !to){
      if(mapErrorEl) mapErrorEl.textContent = 'Enter both a From and To location for the map.';
      if(!from) mapFromEl.classList.add('input-error');
      if(!to) mapToEl.classList.add('input-error');
      return;
    }

    const urls = buildMapUrls(from, to, mode);
    mapFrameEl.src = urls.embedUrl;
    mapOpenLinkEl.href = urls.openUrl;
  }

  function applyPreset(preset){
    if(!preset) return;
    activities = preset.activities.map((item) => ({ name: item.name, minutes: item.minutes, fixed: false, fixedTime: '' }));
    endEvent = { name: preset.endEvent.name, time: preset.endEvent.time };
    showValidation('');
    document.querySelectorAll('.input-error').forEach((el) => el.classList.remove('input-error'));
    saveState();
    render();
    calculate();
  }

  function boot(){
    tbodyEl = document.getElementById('tbody');
    addBtnEl = document.getElementById('addBtn');
    modeToggleEl = document.getElementById('modeToggle');
    presetPreflightBtnEl = document.getElementById('presetPreflightBtn');
    presetDanceBtnEl = document.getElementById('presetDanceBtn');
    nameInputEl = document.getElementById('customName');
    minutesInputEl = document.getElementById('customMinutes');
    formErrorEl = document.getElementById('formError');
    mapFromEl = document.getElementById('mapFrom');
    mapToEl = document.getElementById('mapTo');
    mapModeEl = document.getElementById('mapMode');
    mapFrameEl = document.getElementById('mapFrame');
    mapErrorEl = document.getElementById('mapError');
    mapUpdateBtnEl = document.getElementById('mapUpdateBtn');
    mapOpenLinkEl = document.getElementById('mapOpenLink');

    if(!tbodyEl){
      console.error('Scheduler init error: tbody not found');
      return;
    }

    const saved = safeStore.get('scheduler-theme');
    const prefersDark = (typeof window.matchMedia === 'function') && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const startDark = saved ? saved === 'dark' : !!prefersDark;
    document.body.classList.toggle('dark', startDark);
    if(modeToggleEl){
      modeToggleEl.checked = startDark;
      modeToggleEl.addEventListener('change', ()=>{
        const isDark = !!modeToggleEl.checked;
        document.body.classList.toggle('dark', isDark);
        safeStore.set('scheduler-theme', isDark ? 'dark' : 'light');
      });
    }

    loadState();

    if(addBtnEl){
      addBtnEl.addEventListener('click', addActivity);
    }
    if(presetPreflightBtnEl){
      presetPreflightBtnEl.addEventListener('click', ()=>applyPreset(PRESETS.preflight));
    }
    if(presetDanceBtnEl){
      presetDanceBtnEl.addEventListener('click', ()=>applyPreset(PRESETS.dance));
    }

    [nameInputEl, minutesInputEl].forEach((el)=>{
      if(!el) return;
      el.addEventListener('input', ()=>{
        clearFieldError(el);
        showValidation('');
      });
      el.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          addActivity();
        }
      });
    });

    if(mapUpdateBtnEl){
      mapUpdateBtnEl.addEventListener('click', updateMap);
    }
    [mapFromEl, mapToEl].forEach((el)=>{
      if(!el) return;
      el.addEventListener('input', ()=>clearFieldError(el));
      el.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          updateMap();
        }
      });
    });
    if(mapModeEl){
      mapModeEl.addEventListener('change', updateMap);
    }
    if(mapOpenLinkEl){
      mapOpenLinkEl.href = 'https://www.google.com/maps';
    }

    render();
    calculate();
  }

  function render(){
    tbodyEl.innerHTML = '';

    activities.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'activity-card';
      row.dataset.index = i;
      const startCellHtml = a.fixed
        ? `<div class="card-start start"><input type="text" placeholder="e.g., 4:00 PM" value="${escapeHtml(a.fixedTime || '')}" data-action="fixedtime" data-i="${i}" /></div>`
        : `<div class="card-start start" data-i="${i}"></div>`;
      row.innerHTML = `
        <div class="card-handle">
          <span class="handle" title="Drag to reorder" draggable="true" aria-label="Drag handle">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 5h2v2H7V5zm4 0h2v2h-2V5zM7 9h2v2H7V9zm4 0h2v2h-2V9zM7 13h2v2H7v-2zm4 0h2v2h-2v-2z"/></svg>
          </span>
        </div>
        <div class="card-activity col-activity"><input type="text" value="${escapeHtml(a.name)}" data-action="name" data-i="${i}" /></div>
        <div class="card-minutes col-minutes"><input type="number" min="1" value="${a.minutes}" data-action="minutes" data-i="${i}" /></div>
        ${startCellHtml}
        <div class="card-fixed"><input type="checkbox" data-action="fixedtoggle" data-i="${i}" ${a.fixed ? 'checked' : ''} aria-label="Fixed start time" /></div>
        <div class="card-delete">
          <button class="icon-btn trash" data-action="del" data-i="${i}" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>`;
      tbodyEl.appendChild(row);
    });

    const endRow = document.createElement('div');
    endRow.className = 'activity-card end-row';
    endRow.innerHTML = `
      <div class="card-handle"></div>
      <div class="card-activity col-activity"><input type="text" value="${escapeHtml(endEvent.name)}" id="endName" /></div>
      <div class="card-minutes"></div>
      <div class="card-start start"><input type="text" id="endTime" placeholder="e.g., 3:45 PM" /></div>
      <div class="card-fixed"></div>
      <div class="card-delete"></div>`;
    tbodyEl.appendChild(endRow);

    const endTimeInput = document.getElementById('endTime');
    if(endTimeInput && endEvent.time) endTimeInput.value = endEvent.time;

    const endNameInput = document.getElementById('endName');
    if(endNameInput){
      endNameInput.addEventListener('input', (e)=>{
        endEvent.name = e.target.value;
        saveState();
      });
    }

    if(endTimeInput){
      endTimeInput.addEventListener('input', (e)=>{
        const value = e.target.value;
        const parsed = parseTimeInput(value);
        if(value && !parsed){
          setFieldError(e.target, 'Final event time must be in 12-hour format (e.g., 3:45 PM).');
          paintStartTimes([]);
          return;
        }
        clearFieldError(e.target);
        showValidation('');
        endEvent.time = parsed ? parsed.normalized : '';
        e.target.value = endEvent.time;
        saveState();
        calculate();
      });
    }

    paintStartTimes();
  }

  document.addEventListener('input', (e)=>{
    const t = e.target;
    if(!t || !t.dataset) return;

    const action = t.dataset.action;
    if(!action) return;

    const i = parseInt(t.dataset.i, 10);
    if(Number.isNaN(i)) return;

    if(action === 'name'){
      const trimmed = (t.value || '').trim();
      if(!trimmed){
        setFieldError(t, 'Activity name cannot be empty.');
        return;
      }
      clearFieldError(t);
      showValidation('');
      activities[i].name = t.value;
      saveState();
      calculate();
    } else if(action === 'minutes'){
      const parsed = parseInt(t.value || '', 10);
      if(Number.isNaN(parsed) || parsed < 1){
        setFieldError(t, 'Minutes must be at least 1.');
        return;
      }
      clearFieldError(t);
      showValidation('');
      activities[i].minutes = parsed;
      saveState();
      calculate();
    } else if(action === 'fixedtime'){
      const value = (t.value || '').trim();
      if(!value){
        clearFieldError(t);
        showValidation('');
        activities[i].fixedTime = '';
        saveState();
        calculate();
        return;
      }
      const parsed = parseTimeInput(value);
      if(!parsed){
        setFieldError(t, 'Fixed time must be in 12-hour format (e.g., 4:00 PM).');
        paintStartTimes([]);
        return;
      }
      clearFieldError(t);
      showValidation('');
      activities[i].fixedTime = parsed.normalized;
      t.value = parsed.normalized;
      saveState();
      calculate();
    }
  });

  document.addEventListener('change', (e)=>{
    const t = e.target;
    if(!t || !t.dataset) return;
    if(t.dataset.action !== 'fixedtoggle') return;

    const i = parseInt(t.dataset.i, 10);
    if(Number.isNaN(i) || !activities[i]) return;

    const row = t.closest('.activity-card');
    const suggestedStart = row ? (row.querySelector('.start') && !row.querySelector('input[data-action="fixedtime"]')
      ? row.querySelector('.start').textContent.trim()
      : '') : '';

    activities[i].fixed = !!t.checked;
    if(activities[i].fixed && !activities[i].fixedTime){
      const parsedSuggested = parseTimeInput(suggestedStart);
      if(parsedSuggested){
        activities[i].fixedTime = parsedSuggested.normalized;
      }
    }
    saveState();
    render();
    calculate();
  });

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest && e.target.closest('button');
    if(btn && btn.dataset && btn.dataset.action === 'del'){
      const i = parseInt(btn.dataset.i, 10);
      if(!Number.isNaN(i)){
        activities.splice(i, 1);
        saveState();
        render();
        calculate();
      }
    }
  });

  let draggingRow = null;

  document.addEventListener('dragstart', (e)=>{
    const handle = e.target.closest && e.target.closest('.handle');
    if(!handle) return;

    const row = handle.closest('.activity-card');
    if(!row || row.classList.contains('end-row')) return;

    draggingRow = row;
    row.classList.add('dragging');
  });

  document.addEventListener('dragend', ()=>{
    if(draggingRow){
      draggingRow.classList.remove('dragging');
      draggingRow = null;
    }
  });

  document.addEventListener('dragover', (e)=>{
    if(!draggingRow) return;

    e.preventDefault();
    const after = getDragAfterElement(tbodyEl, e.clientY);
    if(after == null){
      tbodyEl.insertBefore(draggingRow, tbodyEl.lastElementChild);
    } else {
      tbodyEl.insertBefore(draggingRow, after);
    }
  });

  document.addEventListener('drop', ()=>{
    if(!draggingRow) return;

    const rows = Array.from(tbodyEl.querySelectorAll('.activity-card:not(.end-row)'));
    activities = rows.map((r) => activities[parseInt(r.dataset.index, 10)]);
    draggingRow = null;
    saveState();
    render();
    calculate();
  });

  function getDragAfterElement(container, y){
    const rows = [...container.querySelectorAll('.activity-card:not(.dragging):not(.end-row)')];
    return rows.reduce((closest, child)=>{
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if(offset < 0 && offset > closest.offset){
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element || null;
  }

  function calculate(){
    const n = activities.length;
    const durationAt = (i) => (parseInt(activities[i].minutes, 10) || 0);

    const anchors = [];
    for(let i = 0; i < n; i++){
      const a = activities[i];
      if(!a.fixed) continue;
      if(!a.fixedTime){
        showValidation('Set a fixed start time for each checked Fixed? item.');
        paintStartTimes([]);
        return;
      }
      const parsedFixed = parseTimeInput(a.fixedTime);
      if(!parsedFixed){
        showValidation('Set a valid fixed start time (e.g., 4:00 PM) for each checked Fixed? item.');
        paintStartTimes([]);
        return;
      }
      anchors.push({ index: i, minute: parsedFixed.hours24 * 60 + parsedFixed.minutes });
    }

    if(endEvent.time){
      const parsedEnd = parseTimeInput(endEvent.time);
      if(parsedEnd){
        anchors.push({ index: n, minute: parsedEnd.hours24 * 60 + parsedEnd.minutes });
      }
    }

    if(anchors.length === 0){
      showValidation('');
      paintStartTimes([]);
      return;
    }
    showValidation('');
    anchors.sort((a, b) => a.index - b.index);

    const startsMinutes = new Array(n).fill(null);
    for(let a = 0; a < anchors.length; a++){
      const anchor = anchors[a];
      if(anchor.index < n){
        startsMinutes[anchor.index] = anchor.minute;
      }
      const lowerBound = a > 0 ? anchors[a - 1].index + 1 : 0;
      let running = anchor.minute;
      for(let i = anchor.index - 1; i >= lowerBound; i--){
        running -= durationAt(i);
        startsMinutes[i] = running;
      }
    }

    const lastAnchor = anchors[anchors.length - 1];
    if(lastAnchor.index < n && startsMinutes[lastAnchor.index] != null){
      let running = startsMinutes[lastAnchor.index];
      for(let i = lastAnchor.index + 1; i < n; i++){
        running += durationAt(i - 1);
        startsMinutes[i] = running;
      }
    }

    const starts = new Array(n).fill('');
    for(let i = 0; i < n; i++){
      if(startsMinutes[i] == null) continue;
      const wrapped = ((startsMinutes[i] % 1440) + 1440) % 1440;
      const h = Math.floor(wrapped / 60);
      const m = wrapped % 60;
      starts[i] = format12Hour(h, m);
    }

    paintStartTimes(starts);
  }

  function paintStartTimes(starts){
    const rows = tbodyEl.querySelectorAll('.activity-card');
    for(let i = 0; i < activities.length; i++){
      const row = rows[i];
      if(!row) continue;
      const startCell = row.querySelector('.start');
      if(!startCell) continue;
      if(startCell.querySelector('input[data-action="fixedtime"]')) continue;
      startCell.textContent = starts && starts[i] ? starts[i] : '';
    }
  }

  function escapeHtml(s){
    return (s + '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
