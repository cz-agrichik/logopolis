'use strict';
// ============================================================
//  Кипропедия на ПК: оверлей с оглавлением слева.
//  Статьи и оглавление — в content/ru/pedia.js (PediaBook).
// ============================================================

const Pedia = {
  current: 'a:basics',

  open(id) {
    if (id) this.current = id;
    $('#pedia').classList.remove('hidden');
    $('#pedia .pedia-box').classList.remove('nav-open');   // телефон: сразу статья, оглавление — по ☰
    if (!this.bound) {
      this.bound = true;
      $('#pedia').addEventListener('click', e => {
        if (e.target.id === 'pedia' || e.target.closest('[data-pedia-close]')) return this.close();
        const pt = e.target.closest('[data-part]');
        if (pt) {
          if (PediaBook.partOf(this.current) !== pt.dataset.part) {
            this.lastByPart = Object.assign(this.lastByPart || {}, { [PediaBook.partOf(this.current)]: this.current });
            this.current = (this.lastByPart || {})[pt.dataset.part] || (pt.dataset.part === 'study' ? 'a:study' : 'a:basics');
            this.render();
          }
          return;
        }
        if (e.target.closest('[data-school-open]')) { this.close(); return School.open(); }
        const a = e.target.closest('[data-pedia]');
        if (a) { e.preventDefault(); this.current = a.dataset.pedia; this.render(); }
      });
    }
    this.render();
  },
  close() { $('#pedia').classList.add('hidden'); },

  nav() {
    const d = PediaBook.navData(this.current);
    const item = it => `<a href="#" class="pn-item ${it.id === this.current ? 'active' : ''}" data-pedia="${it.id}"><span>${it.icon}</span>${esc(it.title)}</a>`;
    const switcher = `<div class="pn-parts">${d.parts.map(pt => `<button class="pn-part ${d.part === pt.id ? 'active' : ''}" data-part="${pt.id}">${pt.title}</button>`).join('\n      ')}</div>`;
    return switcher + d.groups.map(g => `<div class="pn-group"><div class="pn-title">${g.title}</div>${g.items.map(item).join('')}</div>`).join('') +
      (d.foot ? `\n        <div class="pn-foot"><button class="link" data-school-open>${d.foot}</button></div>` : '');
  },

  render() {
    $('#pediaNav').innerHTML = this.nav();
    $('#pediaBody').innerHTML = PediaBook.article(this.current);
    $('#pediaBody').scrollTop = 0;
    const act = $('#pediaNav .active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  },

};
