// Seven Wonders Main Menu Script

// Game data structure for future expansion
const games = {
    pyramid: {
        name: 'Pyramid',
        description: 'The Great Pyramid of Giza',
        status: 'available',
        url: 'pyramid.html'
    },
    gardens: {
        name: 'Gardens',
        description: 'The Hanging Gardens of Babylon',
        status: 'available',
        url: 'gardens.html'
    },
    temple: {
        name: 'Temple',
        description: 'The Temple of Artemis at Ephesus',
        status: 'available',
        url: 'temple.html'
    },
    statue: {
        name: 'Statue',
        description: 'The Statue of Zeus at Olympia',
        status: 'available',
        url: 'statue.html'
    },
    mausoleum: {
        name: 'Mausoleum',
        description: 'The Mausoleum at Halicarnassus',
        status: 'available',
        url: 'mausoleum.html'
    },
    colossus: {
        name: 'Colossus',
        description: 'The Colossus of Rhodes',
        status: 'available',
        url: 'colossus.html'
    },
    pharos: {
        name: 'Pharos',
        description: 'The Lighthouse of Alexandria',
        status: 'available',
        url: 'pharos.html'
    },
    colosseum: {
        name: 'Colosseum',
        description: 'The Flavian Amphitheatre',
        status: 'playtest',
        url: 'colosseum.html'
    },
    great_wall: {
        name: 'Great Wall',
        description: 'The Great Wall of China',
        status: 'playtest',
        url: 'great_wall.html'
    },
    pagoda: {
        name: 'Pagoda',
        description: 'The Tower of Babel',
        status: 'playtest',
        url: 'pagoda.html'
    },
    citadel: {
        name: 'Citadel',
        description: 'Machu Picchu',
        status: 'playtest',
        url: 'citadel.html'
    },
    basilica: {
        name: 'Basilica',
        description: 'St. Peter\'s Basilica',
        status: 'playtest',
        url: 'basilica.html'
    },
    palace: {
        name: 'Palace',
        description: 'The Forbidden City',
        status: 'playtest',
        url: 'palace.html'
    },
    skyscraper: {
        name: 'Skyscraper',
        description: 'Empire State Building',
        status: 'available',
        url: 'skyscraper.html'
    }
};

// Handle game selection
document.addEventListener('DOMContentLoaded', () => {
    const gameLinks = document.querySelectorAll('.game-link');

    gameLinks.forEach(link => {
        // Use data-id if available, otherwise fallback (for safety)
        const gameId = link.dataset.id || link.getAttribute('href').substring(1);
        const game = games[gameId];

        link.addEventListener('click', (e) => {
            // Prevent default for all links handled by JS to check status
            if (game) {
                e.preventDefault();
                handleGameSelection(gameId);
            }
        });
    });
});

function handleGameSelection(gameId) {
    const game = games[gameId];

    if (game) {
        console.log(`Selected game: ${game.name}`);

        if (game.status === 'available' && game.url) {
            // Navigate to the game page
            window.location.href = game.url;
        } else if (game.status === 'playtest' && game.url) {
            // Check password for playtest games
            const password = prompt(`${game.name} is currently only open to playtesters.\n\nPlease enter the access password:`);
            if (password === '2020') {
                window.location.href = game.url;
            } else if (password !== null) { // If user cancelled, do nothing. If wrong password, alert.
                alert('Incorrect password.');
            }
        } else {
            // Show coming soon message
            alert(`${game.name}\n\n${game.description}\n\nComing Soon...`);
        }
    }
}

// Add subtle entrance animation
window.addEventListener('load', () => {
    const container = document.querySelector('.container');
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';

    setTimeout(() => {
        container.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
});

// --- 3D Menu Stone Interaction ---
document.addEventListener('DOMContentLoaded', () => {
    const flipper = document.querySelector('.menu-flipper');
    const container = document.querySelector('.menu-container-3d');
    const showNewBtn = document.getElementById('show-new-wonders');
    const showOldBtn = document.getElementById('show-old-wonders');

    if (!flipper) return;

    let rotationY = 0;
    let isDragging = false;
    let startX = 0;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;

    // Apply rotation
    const updateRotation = () => {
        flipper.style.transform = `rotateY(${rotationY}deg)`;
    };

    // Auto-flipper buttons still work but interact with the rotation state
    if (showNewBtn) {
        showNewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            velocity = 15; // Give it a spin
        });
    }

    if (showOldBtn) {
        showOldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            velocity = -15; // Spin other way
        });
    }

    // Drag Interaction
    const onStart = (e) => {
        isDragging = true;
        startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        lastX = startX;
        lastTime = Date.now();
        velocity = 0;
        flipper.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const deltaX = currentX - lastX;

        rotationY += deltaX * 0.5; // Sensitivity
        updateRotation();

        const currentTime = Date.now();
        const timeDelta = currentTime - lastTime;
        if (timeDelta > 0) {
            velocity = (deltaX / timeDelta) * 10;
        }

        lastX = currentX;
        lastTime = currentTime;
    };

    const onEnd = () => {
        isDragging = false;
        flipper.style.transition = 'transform 0.1s ease-out';
    };

    // Inertia Loop
    const animate = () => {
        if (!isDragging) {
            rotationY += velocity;
            velocity *= 0.95; // Friction

            // Snap to faces if slow enough
            if (Math.abs(velocity) < 0.1) {
                velocity = 0;
                // Optional: Snap to 0 or 180
                const target = Math.round(rotationY / 180) * 180;
                rotationY += (target - rotationY) * 0.1;
            }
            updateRotation();
        }
        requestAnimationFrame(animate);
    };

    container.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    container.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    // Initial check for URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('menu') === 'new') {
        rotationY = 180;
    }

    requestAnimationFrame(animate);
});
