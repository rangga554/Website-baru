// ==============================================
// ✅ MINECRAFT 2D — RANTAX EDITION
// Pasang · Hapus · Save · Load · Reset
// ==============================================

// === KONFIGURASI DUNIA ===
const WORLD_W = 24;
const WORLD_H = 16;
const BLOCK_SIZE = 32;

// === DAFTAR BLOCK ===
const BLOCKS = {
    AIR:   { id: 0, name: 'Udara', color: 'transparent' },
    GRASS: { id: 1, name: 'Rumput', color: '#4CAF50' },
    DIRT:  { id: 2, name: 'Tanah', color: '#8D6E63' },
    STONE: { id: 3, name: 'Batu', color: '#78909C' },
    WOOD:  { id: 4, name: 'Kayu', color: '#8D5524' },
    LEAVES:{ id: 5, name: 'Daun', color: '#2E7D32' },
    WATER: { id: 6, name: 'Air', color: '#2196F3' },
    SAND:  { id: 7, name: 'Pasir', color: '#FDD835' },
    BEDROCK:{id: 8, name: 'Bedrock', color: '#212121'}
};

const BLOCK_LIST = Object.values(BLOCKS).filter(b => b.id > 0);
let selectedBlock = BLOCKS.GRASS;
let worldData = [];
let playerX = Math.floor(WORLD_W / 2);
let playerY = 4;

// ==============================================
// 1. INISIALISASI DUNIA — ALAM OTOMATIS
// ==============================================
function initWorld() {
    worldData = [];
    for (let y = 0; y < WORLD_H; y++) {
        for (let x = 0; x < WORLD_W; x++) {
            if (y === WORLD_H - 1) worldData.push(BLOCKS.BEDROCK.id);
            else if (y === WORLD_H - 2) worldData.push(BLOCKS.DIRT.id);
            else if (y === WORLD_H - 3) worldData.push(BLOCKS.GRASS.id);
            else if (y > WORLD_H - 6) worldData.push(Math.random() > 0.7 ? BLOCKS.STONE.id : BLOCKS.DIRT.id);
            else if (y < 3 && Math.random() > 0.92) worldData.push(BLOCKS.WOOD.id);
            else if (y < 2 && Math.random() > 0.85) worldData.push(BLOCKS.LEAVES.id);
            else worldData.push(BLOCKS.AIR.id);
        }
    }
}

// ==============================================
// 2. RENDER DUNIA — GAMBAR SEMUA BLOCK
// ==============================================
function renderWorld() {
    const worldEl = document.getElementById('world');
    worldEl.innerHTML = '';

    for (let y = 0; y < WORLD_H; y++) {
        const row = document.createElement('div');
        row.className = 'row';

        for (let x = 0; x < WORLD_W; x++) {
            const idx = y * WORLD_W + x;
            const blockId = worldData[idx];
            const blockInfo = BLOCK_LIST.find(b => b.id === blockId) || BLOCKS.AIR;

            const block = document.createElement('div');
            block.className = 'block';
            block.style.backgroundColor = blockInfo.color;
            block.dataset.x = x;
            block.dataset.y = y;

            // === KLIK = PASANG BLOCK ===
            block.addEventListener('click', () => {
                if (selectedBlock.id === BLOCKS.BEDROCK.id) {
                    alert('⚠️ Bedrock hanya untuk lapisan paling bawah!');
                    return;
                }
                worldData[idx] = selectedBlock.id;
                renderWorld();
            });

            // === KLIK KANAN / TAHAN = HAPUS BLOCK ===
            block.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (blockId === BLOCKS.BEDROCK.id) {
                    alert('🛡️ Bedrock tidak bisa dihapus!');
                    return;
                }
                worldData[idx] = BLOCKS.AIR.id;
                renderWorld();
            });

            row.appendChild(block);
        }
        worldEl.appendChild(row);
    }

    // Update koordinat
    document.getElementById('posX').textContent = playerX;
    document.getElementById('posY').textContent = playerY;
}

// ==============================================
// 3. RENDER TAS BLOCK
// ==============================================
function renderInventory() {
    const inv = document.getElementById('inventory');
    inv.innerHTML = '';

    BLOCK_LIST.forEach(block => {
        const btn = document.createElement('div');
        btn.className = 'inv-block' + (block.id === selectedBlock.id ? ' selected' : '');
        btn.style.backgroundColor = block.color;
        btn.title = block.name;
        btn.addEventListener('click', () => {
            selectedBlock = block;
            renderInventory();
        });
        inv.appendChild(btn);
    });
}

// ==============================================
// 4. SAVE DUNIA — LocalStorage
// ==============================================
document.getElementById('btnSave').addEventListener('click', () => {
    const data = {
        world: worldData,
        player: { x: playerX, y: playerY },
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('rantax_mc2d_world', JSON.stringify(data));
    alert('✅ Dunia berhasil disimpan!');
});

// ==============================================
// 5. LOAD DUNIA
// ==============================================
document.getElementById('btnLoad').addEventListener('click', () => {
    const saved = localStorage.getItem('rantax_mc2d_world');
    if (!saved) {
        alert('❌ Belum ada dunia yang disimpan!');
        return;
    }
    try {
        const data = JSON.parse(saved);
        worldData = data.world;
        playerX = data.player.x;
        playerY = data.player.y;
        renderWorld();
        alert('✅ Dunia berhasil dimuat!');
    } catch (e) {
        alert('❌ Gagal memuat dunia!');
    }
});

// ==============================================
// 6. RESET DUNIA
// ==============================================
document.getElementById('btnReset').addEventListener('click', () => {
    if (!confirm('⚠️ Yakin ingin mengatur ulang dunia? Semua perubahan akan hilang!')) return;
    initWorld();
    playerX = Math.floor(WORLD_W / 2);
    playerY = 4;
    renderWorld();
    alert('✅ Dunia direset!');
});

// ==============================================
// 🚀 MULAI GAME!
// ==============================================
initWorld();
renderWorld();
renderInventory();
console.log('🎮 RANTAX Minecraft 2D — Siap Dimainkan!');
