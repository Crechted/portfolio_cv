const PROJECTS = {
  giiga: {
    titleKey: 'projects.giiga.title',
    roleKey: 'projects.giiga.role',
    metaKey: 'projects.giiga.meta',
    paragraphKeys: [
      'projects.giiga.p1',
      'projects.giiga.p2',
      'projects.giiga.p3'
    ],
    tools: ['C++20', 'DirectX 12', 'HLSL', 'RenderDoc', 'Jolt', 'PyBullet', 'ImGui', 'GitHub'],
    media: {
      type: 'video',
      src: 'assets/Video/GiigaEngine_Gamestus_game.webm',
      captionKey: 'common.trailerCaption'
    },
    link: 'https://github.com/GiiGaTeam/GiiGaEngine',
    linkText: 'github.com/GiiGaTeam/GiiGaEngine'
  },
  dacha: {
    titleKey: 'projects.dacha.title',
    roleKey: 'projects.dacha.role',
    metaKey: 'projects.dacha.meta',
    paragraphKeys: [
      'projects.dacha.p1',
      'projects.dacha.p2',
      'projects.dacha.p3',
      'projects.dacha.p4',
      'projects.dacha.p5'
    ],
    tools: ['C++', 'Blueprints', 'UE4', 'UE5', 'UMG', 'Slate', 'Behavior Tree', 'Materials', 'Rider', 'GitHub'],
    media: {
      type: 'iframe',
      src: 'https://vk.ru/video_ext.php?oid=-212496568&id=456240252&hash=250d01b51d080920',
      captionKey: 'common.trailerCaption'
    },
    link: 'https://vkplay.ru/play/game/project-dacha/',
    linkText: 'vkplay.ru/play/game/project-dacha/'
  },
  gravusach: {
    titleKey: 'projects.gravusach.title',
    roleKey: 'projects.gravusach.role',
    metaKey: 'projects.gravusach.meta',
    paragraphKeys: [
      'projects.gravusach.p1',
      'projects.gravusach.p2',
      'projects.gravusach.p3',
      'projects.gravusach.p4'
    ],
    tools: ['C++', 'Blueprints', 'UE5', 'UMG', 'Niagara', 'Sound Cues', 'Materials', 'Rider', 'GitHub'],
    media: {
      type: 'youtube',
      src: 'https://www.youtube.com/embed/Tw301YyGYqw',
      captionKey: 'common.trailerCaption'
    },
    link: 'https://crechted.itch.io/gravusach',
    linkText: 'crechted.itch.io/gravusach'
  },
  dualrun: {
    titleKey: 'projects.dualrun.title',
    roleKey: 'projects.dualrun.role',
    metaKey: 'projects.dualrun.meta',
    paragraphKeys: [
      'projects.dualrun.p1',
      'projects.dualrun.p2'
    ],
    tools: ['C#', 'Unity', 'Visual Studio', 'Firebase', 'GitHub'],
    media: {
      type: 'video',
      src: 'assets/Video/DualRun.mp4',
      captionKey: 'common.trailerCaption'
    },
    link: 'https://github.com/Crechted/DualRun',
    linkText: 'github.com/Crechted/DualRun'
  },
  glintasync: {
    titleKey: 'projects.glintasync.title',
    roleKey: 'projects.glintasync.role',
    metaKey: 'projects.glintasync.meta',
    paragraphKeys: [
      'projects.glintasync.p1',
      'projects.glintasync.p2',
      'projects.glintasync.p3'
    ],
    tools: ['C++', 'UE5', 'Materials', 'HLSL', 'DirectX 12', 'RenderDoc', 'NVIDIA Nsight Graphics', 'Unreal Insights'],
    media: null,
    link: 'https://github.com/Crechted/GlintAsync',
    linkText: 'github.com/Crechted/GlintAsync'
  }
};

const EXPERIENCE = {
  rtim: {
    titleKey: 'projects.rtim.title',
    roleKey: 'projects.rtim.role',
    metaKey: 'projects.rtim.meta',
    paragraphKeys: [
      'projects.rtim.p1',
      'projects.rtim.p2',
      'projects.rtim.p3',
      'projects.rtim.p4',
      'projects.rtim.p5'
    ],
    tools: ['C++', 'Blueprints', 'UE5', 'UMG', 'Nanite', 'Materials', 'Unreal Insights', 'RuntimeMeshComponent', 'PCG', 'State Machine', 'VaRest', 'OpenStreetMap', 'TeamCity', 'Rider', 'GitLab'],
    media: null,
    link: 'https://rtim.city',
    linkText: 'rtim.city'
  },
  hk: {
    titleKey: 'projects.hk.title',
    roleKey: 'projects.hk.role',
    metaKey: 'projects.hk.meta',
    paragraphKeys: [
      'projects.hk.p1',
      'projects.hk.p2',
      'projects.hk.p3',
      'projects.hk.p4',
      'projects.hk.p5'
    ],
    tools: ['C++20', 'Drogon', 'PostgreSQL', 'Redis', 'OpenCode', 'VS Code', 'WSL', 'Jira', 'Confluence', 'GitLab'],
    media: null,
    link: 'https://app.hamsterking.games',
    linkText: 'app.hamsterking.games'
  }
};

const overlay = document.getElementById('modal-overlay');
const modal = overlay.querySelector('.modal');
const closeBtn = document.getElementById('modal-close');
const titleEl = document.getElementById('modal-title');
const roleEl = document.getElementById('modal-role');
const metaEl = document.getElementById('modal-meta');
const descEl = document.getElementById('modal-desc');
const bulletsEl = document.getElementById('modal-bullets');
const toolsEl = document.getElementById('modal-tools');
const linkEl = document.getElementById('modal-link');
const mediaEl = document.getElementById('modal-media');
const ammoBtn = document.getElementById('modal-ammo-btn');
const ammoLabel = document.getElementById('modal-ammo-label');

function renderMedia(m) {
  mediaEl.textContent = '';

  if (!m) return;

  const caption = document.createElement('p');
  caption.className = 'modal-media-caption';
  caption.textContent = i18n.t(m.captionKey);

  if (m.type === 'video') {
    const video = document.createElement('video');
    video.src = m.src;
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('muted', '');
    mediaEl.appendChild(video);
  } else if (m.type === 'youtube') {
    const frame = document.createElement('iframe');
    frame.src = m.src + '?rel=0&modestbranding=1&color=white&iv_load_policy=3';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('title', i18n.t(m.captionKey));
    mediaEl.appendChild(frame);
  } else if (m.type === 'iframe') {
    const frame = document.createElement('iframe');
    frame.src = m.src;
    frame.style.background = '#000';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen', '1');
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('title', i18n.t(m.captionKey));
    mediaEl.appendChild(frame);
  } else if (m.type === 'img') {
    const img = document.createElement('img');
    img.src = m.src;
    img.alt = m.alt || '';
    img.loading = 'lazy';
    mediaEl.appendChild(img);
  }

  mediaEl.appendChild(caption);
}

let openKey = null;

function openModal(key) {
  const p = PROJECTS[key] || EXPERIENCE[key];
  if (!p) return;
  openKey = key;

  titleEl.textContent = i18n.t(p.titleKey);
  roleEl.textContent = i18n.t(p.roleKey);
  metaEl.textContent = i18n.t(p.metaKey);

  descEl.textContent = '';
  if (p.paragraphKeys) {
    p.paragraphKeys.forEach((key) => {
      const para = document.createElement('p');
      para.textContent = i18n.t(key);
      descEl.appendChild(para);
    });
  } else if (p.descKey) {
    descEl.textContent = i18n.t(p.descKey);
  }

  renderMedia(p.media);

  bulletsEl.textContent = '';
  if (p.bulletKeys) {
    p.bulletKeys.forEach((b) => {
      const li = document.createElement('li');
      li.textContent = i18n.t(b);
      bulletsEl.appendChild(li);
    });
  }

  toolsEl.textContent = '';
  if (p.tools) {
    p.tools.forEach((tool) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tool;
      toolsEl.appendChild(span);
    });
  }

  linkEl.href = p.link;
  linkEl.textContent = p.linkText;

  updateAmmoBtn();

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  modal.focus();
}

function updateAmmoBtn() {
  const has = window.portfolioGame && window.portfolioGame.isClaimed(openKey);
  ammoBtn.disabled = !!has;
  ammoBtn.classList.toggle('granted', !!has);
  ammoLabel.textContent = i18n.t(has ? 'modal.ammoGot' : 'modal.ammoGet');
}

function closeModal() {
  openKey = null;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  mediaEl.textContent = '';
}

document.querySelectorAll('.project-tile').forEach((btn) => {
  btn.addEventListener('click', () => openModal(btn.dataset.project));
});

closeBtn.addEventListener('click', closeModal);

ammoBtn.addEventListener('click', () => {
  if (openKey && window.portfolioGame && window.portfolioGame.claimAmmo(openKey)) {
    updateAmmoBtn();
    ammoBtn.classList.add('granted-pop');
    const badge = document.createElement('span');
    badge.className = 'ammo-grant-badge';
    badge.textContent = '+1';
    ammoBtn.appendChild(badge);
    setTimeout(() => {
      ammoBtn.classList.remove('granted-pop');
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 850);
  }
});

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
    closeModal();
  }
});

document.addEventListener('langchange', () => {
  if (openKey) openModal(openKey);
});