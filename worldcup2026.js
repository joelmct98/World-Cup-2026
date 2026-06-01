const JSON_FILE = 'worldcup2026_aest.json';

    const STORAGE_KEY = 'wc2026_scores';

    // =============================================
    // FLAG EMOJI MAP
    // =============================================
    const FLAGS = {
      'Algeria':              '🇩🇿',
      'Argentina':            '🇦🇷',
      'Australia':            '🇦🇺',
      'Austria':              '🇦🇹',
      'Belgium':              '🇧🇪',
      'Bosnia & Herzegovina': '🇧🇦',
      'Brazil':               '🇧🇷',
      'Canada':               '🇨🇦',
      'Cape Verde':           '🇨🇻',
      'Colombia':             '🇨🇴',
      'Croatia':              '🇭🇷',
      'Curaçao':              '🇨🇼',
      'Czech Republic':       '🇨🇿',
      'DR Congo':             '🇨🇩',
      'Ecuador':              '🇪🇨',
      'Egypt':                '🇪🇬',
      'England':              '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'France':               '🇫🇷',
      'Germany':              '🇩🇪',
      'Ghana':                '🇬🇭',
      'Haiti':                '🇭🇹',
      'Iran':                 '🇮🇷',
      'Iraq':                 '🇮🇶',
      'Ivory Coast':          '🇨🇮',
      'Japan':                '🇯🇵',
      'Jordan':               '🇯🇴',
      'Mexico':               '🇲🇽',
      'Morocco':              '🇲🇦',
      'Netherlands':          '🇳🇱',
      'New Zealand':          '🇳🇿',
      'Norway':               '🇳🇴',
      'Panama':               '🇵🇦',
      'Paraguay':             '🇵🇾',
      'Portugal':             '🇵🇹',
      'Qatar':                '🇶🇦',
      'Saudi Arabia':         '🇸🇦',
      'Scotland':             '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'Senegal':              '🇸🇳',
      'South Africa':         '🇿🇦',
      'South Korea':          '🇰🇷',
      'Spain':                '🇪🇸',
      'Sweden':               '🇸🇪',
      'Switzerland':          '🇨🇭',
      'Tunisia':              '🇹🇳',
      'Turkey':               '🇹🇷',
      'USA':                  '🇺🇸',
      'Uruguay':              '🇺🇾',
      'Uzbekistan':           '🇺🇿',
    };

    function flagOf(team) { return FLAGS[team] || ''; }

    // allMatches holds every match from the JSON.
    // We store scores/results here in memory so edits
    // are reflected instantly without reloading the file.
    let allMatches = [];

    // =============================================
    // 1. LOAD DATA
    // =============================================
    fetch(JSON_FILE)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        allMatches = data.matches;
          allMatches.forEach((m, i) => m._idx = i);
          mergeSavedScores();
          populateGroupFilter();
        renderFixtures();
        renderStandings();
        renderKnockout();
      })
      .catch(() => {
        const msg = `<p class="error">
          ⚠️ Could not load <strong>${JSON_FILE}</strong><br><br>
          Make sure both files are in the same folder and open<br>
          this page using VS Code's <strong>Live Server</strong> extension.
        </p>`;
        ['fixtures-container','standings-container','knockout-container']
          .forEach(id => document.getElementById(id).innerHTML = msg);
      });


    // =============================================
    // 2. FIXTURES — render & sort chronologically
    // =============================================
    function renderFixtures() {
      const groupVal  = document.getElementById('filterGroup').value;
      const teamVal   = document.getElementById('filterTeam').value.toLowerCase();

      let filtered = allMatches.filter(m => {
        if (!m.group) return false;
        if (groupVal  && m.group !== groupVal) return false;
        if (teamVal   && !m.team1.toLowerCase().includes(teamVal)
                      && !m.team2.toLowerCase().includes(teamVal)) return false;
        return true;
      });

      // Sort chronologically by AEST date + time
      filtered.sort((a, b) =>
        new Date(a.date_aest + 'T' + a.time_aest.slice(0, 5)) -
        new Date(b.date_aest + 'T' + b.time_aest.slice(0, 5))
      );

      const container = document.getElementById('fixtures-container');
      container.innerHTML = '';

      if (filtered.length === 0) {
        container.innerHTML = '<p class="empty">No matches found.</p>';
        return;
      }

      let lastDate = '';
      filtered.forEach(m => {
        const result = m.result || 'upcoming';
        const score  = m.score  || '';

        // Date heading
        if (m.date_aest !== lastDate) {
          lastDate = m.date_aest;
          const d = new Date(m.date_aest + 'T12:00:00');
          const heading = d.toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' });
          const h = document.createElement('div');
          h.className = 'section-heading';
          h.textContent = heading;
          container.appendChild(h);
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'match-wrapper';

        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.idx = m._idx;
        card.innerHTML = `
          <div class="match-date">
            ${m.time_aest.split(' AEST')[0]} AEST
            <span class="time">${m.time_aest.match(/\(([^)]+)\)/)?.[1] || ''}</span>
            <span class="venue">${m.ground}</span>
          </div>
          <div class="team home">${m.team1}<span class="flag">${flagOf(m.team1)}</span></div>
          <div class="score-box ${!score ? 'upcoming' : ''}" id="score-display-${m._idx}">${score || 'vs'}</div>
          <div class="team away"><span class="flag">${flagOf(m.team2)}</span>${m.team2}</div>
          <div class="group-badge">${m.group}</div>
          <button class="clear-inline" id="clear-row-${m._idx}"
            style="${score ? '' : 'display:none'}"
            onclick="event.stopPropagation(); clearResult(${m._idx})">Clear</button>
        `;
        card.addEventListener('click', () => openEdit(m._idx));

        wrapper.appendChild(card);
        container.appendChild(wrapper);
      });
    }

    // =============================================
    // 3. SCORE EDITOR
    // =============================================

    let editingIdx = null;

    function openEdit(idx) {
      if (editingIdx !== null && editingIdx !== idx) cancelEdit(editingIdx);
      if (editingIdx === idx) { cancelEdit(idx); return; }

      editingIdx = idx;
      const m = allMatches[idx];
      const parts = (m.score || '').split('-');
      const s1 = parts[0] ?? '';
      const s2 = parts[1] ?? '';

      const scoreBox = document.getElementById(`score-display-${idx}`);
      scoreBox.className = 'score-box editing';
      scoreBox.innerHTML = `
        <input type="number" id="score1-${idx}" value="${s1}" min="0" max="99" onclick="event.stopPropagation()">
        <span class="score-sep">–</span>
        <input type="number" id="score2-${idx}" value="${s2}" min="0" max="99" onclick="event.stopPropagation()">
      `;

      // Autosave on every keystroke (both inputs must have values)
      ['score1','score2'].forEach(id => {
        document.getElementById(`${id}-${idx}`)
          .addEventListener('input', () => autoSaveFixture(idx));
      });

      // Hide clear button while the inputs are open
      const cb = document.getElementById(`clear-row-${idx}`);
      if (cb) cb.style.display = 'none';
    }

    // Saves whenever both score inputs hold valid numbers — no button needed
    function autoSaveFixture(idx) {
      const s1 = parseInt(document.getElementById(`score1-${idx}`)?.value);
      const s2 = parseInt(document.getElementById(`score2-${idx}`)?.value);
      if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) return;

      allMatches[idx].score  = `${s1}-${s2}`;
      allMatches[idx].result = s1 > s2 ? 'win' : s1 < s2 ? 'loss' : 'draw';
      saveToStorage();
      renderStandings();
      renderKnockout();
    }

    function cancelEdit(idx) {
      editingIdx = null;
      const m = allMatches[idx];
      const scoreBox = document.getElementById(`score-display-${idx}`);
      if (!scoreBox) return;
      scoreBox.className = `score-box${m.score ? '' : ' upcoming'}`;
      scoreBox.textContent = m.score || 'vs';
      // Show clear button again if a score exists
      const cb = document.getElementById(`clear-row-${idx}`);
      if (cb) cb.style.display = m.score ? '' : 'none';
    }

    function clearResult(idx) {
      allMatches[idx].score  = '';
      allMatches[idx].result = 'upcoming';
      saveToStorage();
      const scoreBox = document.getElementById(`score-display-${idx}`);
      if (scoreBox) { scoreBox.className = 'score-box upcoming'; scoreBox.textContent = 'vs'; }
      const cb = document.getElementById(`clear-row-${idx}`);
      if (cb) cb.style.display = 'none';
      renderStandings();
    }


    // =============================================
    // 4. STANDINGS + SHARED GROUP HELPERS
    // =============================================

    function computeGroupStandings(groupName) {
      const gm = allMatches.filter(m => m.group === groupName);
      const teams = {};
      gm.flatMap(m => [m.team1, m.team2]).forEach(t => {
        teams[t] = teams[t] || { team:t, played:0, won:0, drawn:0, lost:0, gf:0, ga:0, gd:0, pts:0 };
      });
      gm.forEach(m => {
        if (!m.score || m.result === 'upcoming') return;
        const [g1, g2] = m.score.split('-').map(Number);
        if (isNaN(g1) || isNaN(g2)) return;
        const t1 = teams[m.team1], t2 = teams[m.team2];
        t1.played++; t2.played++; t1.gf += g1; t1.ga += g2; t2.gf += g2; t2.ga += g1;
        if      (m.result === 'win')  { t1.won++; t1.pts += 3; t2.lost++; }
        else if (m.result === 'loss') { t2.won++; t2.pts += 3; t1.lost++; }
        else                          { t1.drawn++; t1.pts++; t2.drawn++; t2.pts++; }
      });
      Object.values(teams).forEach(s => s.gd = s.gf - s.ga);
      return Object.values(teams).sort((a,b) => b.pts-a.pts || b.gd-a.gd || b.gf-a.gf);
    }

    function isGroupComplete(groupName) {
      const ms = allMatches.filter(m => m.group === groupName);
      return ms.length > 0 && ms.every(m => m.score && m.result !== 'upcoming');
    }

    // Third-place slot codes → eligible group letters (must match JSON exactly)
    const THIRD_SLOT_GROUPS = {
      '3A/B/C/D/F': ['A','B','C','D','F'],
      '3C/D/F/G/H': ['C','D','F','G','H'],
      '3C/E/F/H/I': ['C','E','F','H','I'],
      '3E/H/I/J/K': ['E','H','I','J','K'],
      '3B/E/F/I/J': ['B','E','F','I','J'],
      '3A/E/H/I/J': ['A','E','H','I','J'],
      '3E/F/G/I/J': ['E','F','G','I','J'],
      '3D/E/I/J/L': ['D','E','I','J','L'],
    };

    // Cached assignment, refreshed each time renderKnockout() runs
    let _thirdPlaceMap = {};

    // Rank the 8 best third-place teams globally (pts → gd → gf) then use
    // backtracking to assign each to exactly one slot, so no team appears twice.
    function computeThirdPlaceMapping() {
      const candidates = [];
      'ABCDEFGHIJKL'.split('').forEach(letter => {
        const g = 'Group ' + letter;
        if (!isGroupComplete(g)) return;
        const standings = computeGroupStandings(g);
        if (standings.length >= 3) {
          const s = standings[2];
          candidates.push({ team: s.team, group: letter, pts: s.pts, gd: s.gd, gf: s.gf });
        }
      });

      // Sort: pts → gd → gf (FIFA criteria for best third-place ranking)
      candidates.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
      const qualified = candidates.slice(0, 8);

      const slotKeys = Object.keys(THIRD_SLOT_GROUPS);
      const result = {};

      // Backtracking: assign each ranked team to an eligible, unoccupied slot
      function assign(tIdx, usedSlots) {
        if (tIdx === qualified.length) return true;
        const t = qualified[tIdx];
        for (const slot of slotKeys) {
          if (usedSlots.has(slot)) continue;
          if (THIRD_SLOT_GROUPS[slot].includes(t.group)) {
            usedSlots.add(slot);
            result[slot] = t.team;
            if (assign(tIdx + 1, usedSlots)) return true;
            usedSlots.delete(slot);
            delete result[slot];
          }
        }
        return false;
      }

      assign(0, new Set());
      return result;
    }

    // Resolve a knockout slot code (e.g. "1A", "2B", "3A/B/C", "W73", "L101") → team name or null
    function resolveSlot(code) {
      if (!code) return null;
      const c = code.trim();
      if (/^W\d+$/.test(c)) { const m = allMatches.find(x => x.num === +c.slice(1)); return m?.winner || null; }
      if (/^L\d+$/.test(c)) { const m = allMatches.find(x => x.num === +c.slice(1)); return m?.loser  || null; }
      const pos = c.match(/^([12])([A-L])$/);
      if (pos) {
        const g = 'Group ' + pos[2];
        if (!isGroupComplete(g)) return null;
        return computeGroupStandings(g)[+pos[1]-1]?.team || null;
      }
      // Third-place: look up pre-computed assignment (one team per slot, no duplicates)
      if (/^3[A-L]/.test(c)) return _thirdPlaceMap[c] || null;
      return null;
    }

    // Human-readable label for an unresolved slot code
    function slotLabel(code) {
      if (!code) return 'TBD';
      const c = code.trim();
      if (/^W\d+$/.test(c)) return 'Winner M' + c.slice(1);
      if (/^L\d+$/.test(c)) return 'Loser M'  + c.slice(1);
      const pos = c.match(/^([12])([A-L])$/);
      if (pos) return (+pos[1] === 1 ? 'Winner' : 'Runner-up') + ' Group ' + pos[2];
      const third = c.match(/^3([A-L](?:\/[A-L])+)$/);
      if (third) return 'Best 3rd · ' + third[1];
      return code;
    }

    function renderStandings() {
      const groups = [...new Set(
        allMatches.filter(m => m.group).map(m => m.group)
      )].sort();

      const container = document.getElementById('standings-container');
      container.innerHTML = '';

      const grid = document.createElement('div');
      grid.className = 'standings-grid';

      groups.forEach(groupName => {
        const sorted = computeGroupStandings(groupName).map(s => [s.team, s]);

        // Build the card for this group
        const card = document.createElement('div');
        card.className = 'standings-card';
        card.innerHTML = `
          <h3>${groupName}</h3>
          <table class="standings-table">
            <thead>
              <tr>
                <th class="col-team">Team</th>
                <th>P</th><th>W</th><th>D</th><th>L</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(([team, s], i) => `
                <tr class="${i < 2 ? 'qualified' : i === 2 ? 'possible' : ''}">
                  <td class="col-team"><span class="flag">${flagOf(team)}</span><span class="team-name">${team}</span></td>
                  <td>${s.played}</td>
                  <td>${s.won}</td>
                  <td>${s.drawn}</td>
                  <td>${s.lost}</td>
                  <td>${s.gd > 0 ? '+' + s.gd : s.gd}</td>
                  <td class="pts">${s.pts}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
        grid.appendChild(card);
      });

      container.appendChild(grid);

      // Legend
      const legend = document.createElement('p');
      legend.style.cssText = 'font-size:0.75rem; color:var(--muted); margin-top:0.5rem;';
      legend.innerHTML = '<span style="color:var(--win)">■</span> Qualified &nbsp; <span style="color:var(--gold)">■</span> Potential qualifier (best 3rd place)';
      container.appendChild(legend);
    }


    // =============================================
    // 5. KNOCKOUT BRACKET
    // =============================================

    // Fixed bracket height (px). All y-coordinates are derived from this.
    const BH = 720;

    // Match numbers in visual order (top→bottom) for each round column
    const L_R32 = [74,77,73,75,76,78,79,80];
    const L_R16 = [89,90,91,92];
    const L_QF  = [97,99];
    const L_SF  = [101];
    const R_SF  = [102];
    const R_QF  = [98,100];
    const R_R16 = [93,94,95,96];
    const R_R32 = [83,84,81,82,86,88,85,87];

    // SVG connector pair definitions [y_top, y_bottom, y_mid]
    const CONN_R32_R16 = [[45,135,90],[225,315,270],[405,495,450],[585,675,630]];
    const CONN_R16_QF  = [[90,270,180],[450,630,540]];
    const CONN_QF_SF   = [[180,540,360]];

    function clearKnockoutResults() {
      if (!confirm('Clear all knockout scores and results?')) return;
      allMatches.forEach(m => {
        if (!m.group) {
          m.score = ''; m.result = 'upcoming';
          delete m.winner; delete m.loser; delete m.aetWinner;
        }
      });
      saveToStorage();
      renderKnockout();
    }

    function renderKnockout() {
      // Recompute third-place assignment fresh every render so it stays consistent
      _thirdPlaceMap = computeThirdPlaceMapping();

      const container = document.getElementById('knockout-container');
      container.innerHTML = '';

      // Clear button
      const clearBar = document.createElement('div');
      clearBar.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:1rem;';
      clearBar.innerHTML = `<button class="btn-cancel" onclick="clearKnockoutResults()" style="font-size:0.78rem;">Clear Knockout Results</button>`;
      container.appendChild(clearBar);

      const byNum = {};
      allMatches.forEach(m => { if (m.num) byNum[m.num] = m; });
      const finalM = allMatches.find(m => m.round === 'Final');

      const bracket = document.createElement('div');
      bracket.className = 'bracket';

      // ---- LEFT SIDE (R32 → SF, reads left-to-right) ----
      bracket.appendChild(makeRoundCol(L_R32, 'Rd of 32',    8, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_R32_R16, 'left'));
      bracket.appendChild(makeRoundCol(L_R16, 'Rd of 16',   4, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_R16_QF,  'left'));
      bracket.appendChild(makeRoundCol(L_QF,  'Qtr-final',  2, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_QF_SF,   'left'));
      bracket.appendChild(makeRoundCol(L_SF,  'Semi-final', 1, byNum));
      bracket.appendChild(makeStraightConnector());

      // ---- CENTER ----
      bracket.appendChild(buildCenterCol(finalM));

      // ---- RIGHT SIDE (SF → R32, reads right-to-left) ----
      bracket.appendChild(makeStraightConnector());
      bracket.appendChild(makeRoundCol(R_SF,  'Semi-final', 1, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_QF_SF,   'right'));
      bracket.appendChild(makeRoundCol(R_QF,  'Qtr-final',  2, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_R16_QF,  'right'));
      bracket.appendChild(makeRoundCol(R_R16, 'Rd of 16',   4, byNum));
      bracket.appendChild(makeConnectorSVG(CONN_R32_R16, 'right'));
      bracket.appendChild(makeRoundCol(R_R32, 'Rd of 32',   8, byNum));

      container.appendChild(bracket);
    }

    // ---- Round column ----
    function makeRoundCol(nums, label, count, byNum) {
      const slotH = BH / count;
      const col = document.createElement('div');
      col.className = 'b-round-col';

      const lbl = document.createElement('div');
      lbl.className = 'b-round-label';
      lbl.textContent = label;
      col.appendChild(lbl);

      const slots = document.createElement('div');
      slots.className = 'b-slots';
      slots.style.height = BH + 'px';

      nums.forEach(num => {
        const m = byNum[num];
        const slot = document.createElement('div');
        slot.className = 'b-slot';
        slot.style.height = slotH + 'px';
        if (m) slot.appendChild(buildBracketCard(m));
        slots.appendChild(slot);
      });

      col.appendChild(slots);
      return col;
    }

    // ---- Individual match card for the bracket ----
    function buildBracketCard(m) {
      const team1 = resolveSlot(m.team1);
      const team2 = resolveSlot(m.team2);
      const name1 = team1 || slotLabel(m.team1);
      const name2 = team2 || slotLabel(m.team2);
      const hasTeams = !!(team1 && team2);
      const idx = m._idx;

      const card = document.createElement('div');

      if (!hasTeams) {
        // One or both teams not yet decided — show resolved ones fully, placeholders dimmed
        card.className = 'b-card' + (!team1 && !team2 ? ' b-pending' : '');
        card.innerHTML = `
          <div class="b-team${!team1 ? ' b-tbd' : ''}">
            <span class="b-flag">${team1 ? flagOf(team1) : ''}</span>
            <span class="b-name">${name1}</span>
          </div>
          <div class="b-mid"></div>
          <div class="b-team${!team2 ? ' b-tbd' : ''}">
            <span class="b-flag">${team2 ? flagOf(team2) : ''}</span>
            <span class="b-name">${name2}</span>
          </div>`;
        return card;
      }

      // Both teams known — show inline score inputs
      const s1 = m.score ? m.score.split('-')[0] : '';
      const s2 = m.score ? (m.score.split('-')[1] || '').split(' ')[0] : '';
      const aetWinner = m.aetWinner || '';
      const isTied = s1 !== '' && s2 !== '' && parseInt(s1) === parseInt(s2);
      // AET row only shows when tied AND winner not yet chosen
      const showAet = isTied && !aetWinner;

      card.className = 'b-card b-active' + (m.winner ? ' b-done' : '');
      card.innerHTML = `
        <div class="b-team${m.winner === team1 ? ' b-won' : ''}">
          <span class="b-flag">${flagOf(team1)}</span>
          <span class="b-name" title="${team1}">${team1}</span>
          <input type="number" class="b-score-input" id="bsi1-${idx}"
                 value="${s1}" min="0" max="99" placeholder="–">
        </div>
        <div class="b-mid b-aet-zone" id="baet-${idx}" style="${showAet ? '' : 'display:none'}">
          <span class="b-aet-label">AET</span>
          <button class="b-aet-btn" data-winner="1" title="${team1}">${flagOf(team1)}</button>
          <button class="b-aet-btn" data-winner="2" title="${team2}">${flagOf(team2)}</button>
        </div>
        <div class="b-team${m.winner === team2 ? ' b-won' : ''}">
          <span class="b-flag">${flagOf(team2)}</span>
          <span class="b-name" title="${team2}">${team2}</span>
          <input type="number" class="b-score-input" id="bsi2-${idx}"
                 value="${s2}" min="0" max="99" placeholder="–">
        </div>`;

      card.querySelectorAll('.b-score-input')
          .forEach(inp => inp.addEventListener('input', () => autoSaveKo(m)));

      // AET flag buttons — clicking sets the winner and collapses the row
      card.querySelectorAll('.b-aet-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          m.aetWinner = btn.dataset.winner === '1' ? team1 : team2;
          autoSaveKo(m);
        });
      });

      return card;
    }

    // Autosave a knockout result from inline inputs; cascade-clear downstream if winner changes
    function autoSaveKo(m) {
      const idx = m._idx;
      const inp1 = document.getElementById(`bsi1-${idx}`);
      const inp2 = document.getElementById(`bsi2-${idx}`);
      if (!inp1 || !inp2) return;

      const s1 = parseInt(inp1.value);
      const s2 = parseInt(inp2.value);

      // If either score is cleared, remove this result and cascade downstream
      if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
        if (m.winner || m.score) {
          if (m.num) clearDownstreamKo(m.num);
          m.score = ''; m.result = 'upcoming';
          delete m.winner; delete m.loser; delete m.aetWinner;
          saveToStorage();
          renderKnockout();
        }
        return;
      }

      const team1 = resolveSlot(m.team1);
      const team2 = resolveSlot(m.team2);
      if (!team1 || !team2) return;

      const tied = s1 === s2;

      // Show AET buttons only when tied and no winner chosen yet
      const aetZone = document.getElementById(`baet-${idx}`);
      if (aetZone) aetZone.style.display = (tied && !m.aetWinner) ? '' : 'none';

      let winner, loser;
      if (s1 > s2)      { winner = team1; loser = team2; delete m.aetWinner; }
      else if (s2 > s1) { winner = team2; loser = team1; delete m.aetWinner; }
      else {
        if (!m.aetWinner) return; // wait for flag button tap
        winner = m.aetWinner;
        loser  = winner === team1 ? team2 : team1;
      }

      // If the winner changed, clear any downstream matches that built on the old result
      if (m.winner !== winner && m.num) clearDownstreamKo(m.num);

      m.score  = `${s1}-${s2}`;
      m.result = s1 > s2 ? 'win' : s2 > s1 ? 'loss' : 'draw';
      m.winner = winner;
      m.loser  = loser;
      saveToStorage();
      renderKnockout();
    }

    // Recursively clear any matches whose slots depend on matchNum's winner/loser
    function clearDownstreamKo(matchNum) {
      allMatches.forEach(m => {
        const deps = [m.team1?.trim(), m.team2?.trim()];
        if (deps.includes(`W${matchNum}`) || deps.includes(`L${matchNum}`)) {
          if (m.winner || m.score) {
            if (m.num) clearDownstreamKo(m.num);
            m.score = ''; m.result = 'upcoming';
            delete m.winner; delete m.loser; delete m.aetWinner;
          }
        }
      });
    }

    // ---- Center column (trophy + final + winner) ----
    function buildCenterCol(finalM) {
      const col = document.createElement('div');
      col.className = 'bracket-center';

      const lbl = document.createElement('div');
      lbl.className = 'b-round-label';
      lbl.textContent = 'Final';
      col.appendChild(lbl);

      const inner = document.createElement('div');
      inner.className = 'bc-inner';

      const trophy = document.createElement('img');
      trophy.src = 'https://upload.wikimedia.org/wikipedia/commons/b/ba/FIFA_World_Cup_Icon_%28Campionato_mondiale_di_calcio%29.svg';
      trophy.className = 'bc-trophy';
      trophy.alt = 'FIFA World Cup Trophy';
      inner.appendChild(trophy);

      const finalCardWrap = document.createElement('div');
      finalCardWrap.className = 'bc-final-wrap';
      if (finalM) {
        const card = buildBracketCard(finalM);
        card.classList.add('bc-final-card');
        finalCardWrap.appendChild(card);
      }
      inner.appendChild(finalCardWrap);

      const winnerTeam = finalM?.winner || null;
      const winnerBox = document.createElement('div');
      winnerBox.className = 'bc-winner' + (winnerTeam ? ' bc-winner-filled' : '');
      if (winnerTeam) {
        winnerBox.innerHTML = `
          <div class="bc-winner-label">🏆 World Champion</div>
          <div class="bc-winner-team">
            <span class="bc-winner-flag">${flagOf(winnerTeam)}</span>
            <span class="bc-winner-name">${winnerTeam}</span>
          </div>`;
      } else {
        winnerBox.innerHTML = `<div class="bc-winner-label">Winner</div>`;
      }
      inner.appendChild(winnerBox);

      col.appendChild(inner);
      return col;
    }

    // ---- SVG connector lines between rounds ----
    function makeConnectorSVG(pairs, side) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '24');
      svg.setAttribute('height', BH);
      svg.classList.add('b-connector');
      const stroke = 'rgba(122,171,142,0.45)';

      pairs.forEach(([y1, y2, ym]) => {
        const segs = side === 'left'
          ? [[0,y1,12,y1],[0,y2,12,y2],[12,y1,12,y2],[12,ym,24,ym]]
          : [[24,y1,12,y1],[24,y2,12,y2],[12,y1,12,y2],[12,ym,0,ym]];
        segs.forEach(([x1,ya,x2,yb]) => {
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1',x1); ln.setAttribute('y1',ya);
          ln.setAttribute('x2',x2); ln.setAttribute('y2',yb);
          ln.setAttribute('stroke', stroke);
          ln.setAttribute('stroke-width', '1.5');
          svg.appendChild(ln);
        });
      });
      return svg;
    }

    function makeStraightConnector() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', BH);
      svg.classList.add('b-connector');
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1',0); ln.setAttribute('y1',360);
      ln.setAttribute('x2',16); ln.setAttribute('y2',360);
      ln.setAttribute('stroke','rgba(122,171,142,0.45)');
      ln.setAttribute('stroke-width','1.5');
      svg.appendChild(ln);
      return svg;
    }



    // =============================================
    // 6. HELPERS
    // =============================================
    function clearAllResults() {
      if (!confirm('Clear all saved scores and results?')) return;
      editingIdx = null;
      allMatches.forEach(m => {
        m.score = ''; m.result = 'upcoming';
        delete m.winner; delete m.loser; delete m.aetWinner;
      });
      localStorage.removeItem(STORAGE_KEY);
      renderFixtures();
      renderStandings();
      renderKnockout();
    }

    function saveToStorage() {
      const saved = {};
      allMatches.forEach(m => {
        if (m.score || m.winner || (m.result && m.result !== 'upcoming')) {
          saved[m._idx] = {
            score: m.score || '', result: m.result || 'upcoming',
            winner: m.winner || '', loser: m.loser || '', aetWinner: m.aetWinner || ''
          };
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }

    function mergeSavedScores() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        Object.entries(saved).forEach(([idx, data]) => {
          const m = allMatches[parseInt(idx)];
          if (!m) return;
          m.score = data.score; m.result = data.result;
          if (data.winner)    m.winner    = data.winner;
          if (data.loser)     m.loser     = data.loser;
          if (data.aetWinner) m.aetWinner = data.aetWinner;
        });
      } catch(e) {}
    }

    function populateGroupFilter() {
      const sel = document.getElementById('filterGroup');
      const groups = [...new Set(allMatches.filter(m => m.group).map(m => m.group))].sort();
      groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        sel.appendChild(opt);
      });
    }

    function showTab(name, event) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + name).classList.add('active');
      event.target.classList.add('active');
    }