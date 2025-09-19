import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let animationFrameId = null;

const container = document.getElementById('scene-3d-container');
const canvas = document.getElementById('scene-3d-canvas');
const instructions = document.getElementById('scene-3d-instructions');

// Mobile controls state
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const PI_2 = Math.PI / 2;

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Tap-to-move state
let raycaster;
let walkableObjects = [];
let targetPosition = null;
let isMovingToTarget = false;
let moveIndicator = null;

function setupEventListeners() {
    if (isMobile) {
        instructions.querySelector('div').textContent = 'Tap to move, Drag to look';
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd, { passive: false });
    } else {
        container.addEventListener('click', () => {
            if (controls) controls.lock();
        });

        if (controls) {
            controls.addEventListener('lock', () => {
                instructions.classList.add('hidden');
            });
            controls.addEventListener('unlock', () => {
                instructions.classList.remove('hidden');
            });
        }
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }
}

function removeEventListeners() {
    if (isMobile) {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
    } else {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
    }
}

function onTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isDragging = false;
}

function onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 0) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // Mark as dragging if movement is significant
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        isDragging = true;
    }
    
    if (isDragging && controls) {
        const playerObject = controls.getObject();
        euler.setFromQuaternion(playerObject.quaternion);
        
        // Standard camera rotation sensitivity
        euler.y -= deltaX * 0.003;
        euler.x -= deltaY * 0.003;
        euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
        
        playerObject.quaternion.setFromEuler(euler);
    }
    
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function onTouchEnd(event) {
    event.preventDefault();
    
    if (!isDragging) {
        // It's a tap - handle movement
        const touch = event.changedTouches[0];
        const mouse = new THREE.Vector2();
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(walkableObjects);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            targetPosition = hit.point.clone();
            targetPosition.y = 1.7;
            isMovingToTarget = true;
            if (moveIndicator) {
                moveIndicator.position.set(hit.point.x, 0.02, hit.point.z);
                moveIndicator.visible = true;
                moveIndicator.scale.set(1,1,1);
            }
        }
    }
    
    isDragging = false;
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    const player = controls.getObject();

    if (isMobile && isMovingToTarget && targetPosition) {
        const distance = player.position.distanceTo(targetPosition);
        if (moveIndicator && moveIndicator.visible) {
            const t = time * 0.004;
            const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.15;
            moveIndicator.scale.setScalar(THREE.MathUtils.clamp(distance * 0.12, 0.6, 2.2) * pulse);
        }
        
        if (distance < 0.3) {
            // Reached target
            isMovingToTarget = false;
            targetPosition = null;
            if (moveIndicator) moveIndicator.visible = false;
        } else {
            // Move towards target
            const direction = targetPosition.clone().sub(player.position).normalize();
            const moveSpeed = Math.min(distance * 3, 5); // Speed based on distance
            const moveVector = direction.multiplyScalar(moveSpeed * delta);
            
            // Simple collision check - just ensure we don't go too close to barn
            const newPosition = player.position.clone().add(moveVector);
            const barnCenter = new THREE.Vector3(0, 0, -15);
            const distanceToBarn = newPosition.distanceTo(barnCenter);
            
            if (distanceToBarn > 8) { // Stay at least 8 units from barn center
                player.position.copy(newPosition);
            } else {
                isMovingToTarget = false;
                targetPosition = null;
                if (moveIndicator) moveIndicator.visible = false;
            }
        }
    } else if (!isMobile) {
        // Desktop controls
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 40.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 40.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
    }
    
    // Keep player on ground
    if (controls) {
        player.position.y = 1.7;
    }

    prevTime = time;
    renderer.render(scene, camera);
}

// Desktop controls wrapper
class DesktopControls {
    constructor(camera, domElement) {
        this.controls = new PointerLockControls(camera, domElement);
    }
    getObject() {
        return this.controls.getObject();
    }
    moveForward(distance) {
        this.controls.moveForward(distance);
    }
    moveRight(distance) {
        this.controls.moveRight(distance);
    }
    lock() {
        this.controls.lock();
    }
    addEventListener(event, callback) {
        this.controls.addEventListener(event, callback);
    }
    dispose() {
        this.controls.dispose();
    }
}

// Mobile controls wrapper
class MobileControls {
    constructor(camera) {
        this.playerObject = new THREE.Object3D();
        this.playerObject.add(camera);
    }
    getObject() {
        return this.playerObject;
    }
    dispose() {
        // No-op
    }
}

export function initScene3D() {
    container.style.display = 'block';
    
    // Reset arrays
    walkableObjects = [];

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 0, 75);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Controls
    if (isMobile) {
        controls = new MobileControls(camera);
        const player = controls.getObject();
        player.position.set(0, 1.7, 5);
        
        if (instructions) instructions.classList.remove('hidden');
        raycaster = new THREE.Raycaster();
    } else {
        controls = new DesktopControls(camera, document.body);
        camera.position.y = 1.7;
    }
    scene.add(controls.getObject());

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x444455, 0x111122, 0.5);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.1);
    dirLight.position.set(-15, 20, -5);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Textures
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load('ground_texture.png');
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(25, 25);
    groundTexture.anisotropy = 16;
    
    const barnWallTexture = textureLoader.load('barn_wall.png');
    const barnRoofTexture = textureLoader.load('barn_roof.png');

    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({ map: barnWallTexture });
    const roofMaterial = new THREE.MeshStandardMaterial({ map: barnRoofTexture });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8, metalness: 0.2 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    walkableObjects.push(ground);

    const ringGeo = new THREE.RingGeometry(0.25, 0.5, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    moveIndicator = new THREE.Mesh(ringGeo, ringMat);
    moveIndicator.rotation.x = -Math.PI / 2;
    moveIndicator.position.y = 0.02;
    moveIndicator.visible = false;
    scene.add(moveIndicator);

    // Barn
    const barnGroup = new THREE.Group();
    const BARN_WIDTH = 12;
    const BARN_DEPTH = 18;
    const WALL_HEIGHT = 6;
    const ROOF_HEIGHT = 4;

    // Main building walls
    const mainBuilding = new THREE.Mesh(
        new THREE.BoxGeometry(BARN_WIDTH, WALL_HEIGHT, BARN_DEPTH),
        wallMaterial
    );
    mainBuilding.position.y = WALL_HEIGHT / 2;
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    barnGroup.add(mainBuilding);

    // Main roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-BARN_WIDTH / 2 - 0.5, WALL_HEIGHT);
    roofShape.lineTo(0, WALL_HEIGHT + ROOF_HEIGHT);
    roofShape.lineTo(BARN_WIDTH / 2 + 0.5, WALL_HEIGHT);
    roofShape.lineTo(-BARN_WIDTH / 2 - 0.5, WALL_HEIGHT);
    const extrudeSettings = { depth: BARN_DEPTH + 1, bevelEnabled: false };
    const roofGeometry = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
    const mainRoof = new THREE.Mesh(roofGeometry, roofMaterial);
    mainRoof.position.z = -(BARN_DEPTH + 1) / 2;
    mainRoof.castShadow = true;
    barnGroup.add(mainRoof);
    
    // Gables (triangular parts of the wall)
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-BARN_WIDTH / 2, WALL_HEIGHT);
    gableShape.lineTo(0, WALL_HEIGHT + ROOF_HEIGHT);
    gableShape.lineTo(BARN_WIDTH / 2, WALL_HEIGHT);
    gableShape.lineTo(-BARN_WIDTH / 2, WALL_HEIGHT);
    const gableGeometry = new THREE.ShapeGeometry(gableShape);
    const frontGable = new THREE.Mesh(gableGeometry, wallMaterial);
    frontGable.position.z = BARN_DEPTH / 2;
    barnGroup.add(frontGable);
    const backGable = new THREE.Mesh(gableGeometry, wallMaterial);
    backGable.position.z = -BARN_DEPTH / 2;
    backGable.rotation.y = Math.PI;
    barnGroup.add(backGable);

    // Windows
    const window1 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), windowMaterial);
    window1.position.set(-2.5, 7.5, BARN_DEPTH / 2 + 0.01);
    barnGroup.add(window1);

    const window2 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), windowMaterial);
    window2.position.set(2.5, 7.5, BARN_DEPTH / 2 + 0.01);
    barnGroup.add(window2);
    
    const sideWindow1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), windowMaterial);
    sideWindow1.position.set(BARN_WIDTH/2 + 0.01, 3, 2);
    sideWindow1.rotation.y = Math.PI/2;
    barnGroup.add(sideWindow1);

    const sideWindow2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), windowMaterial);
    sideWindow2.position.set(BARN_WIDTH/2 + 0.01, 3, -2);
    sideWindow2.rotation.y = Math.PI/2;
    barnGroup.add(sideWindow2);

    // Chimneys
    const chimney1 = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 1), roofMaterial);
    chimney1.position.set(-2, WALL_HEIGHT + ROOF_HEIGHT - 0.5, -2);
    barnGroup.add(chimney1);

    const chimney2 = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 1), roofMaterial);
    chimney2.position.set(2.5, WALL_HEIGHT + ROOF_HEIGHT - 1.2, 4);
    barnGroup.add(chimney2);

    // Left side extension
    const EXT_WIDTH = 5;
    const EXT_DEPTH = 8;
    const EXT_HEIGHT = 4;
    const extension = new THREE.Mesh(new THREE.BoxGeometry(EXT_WIDTH, EXT_HEIGHT, EXT_DEPTH), wallMaterial);
    extension.position.set(-(BARN_WIDTH / 2 + EXT_WIDTH / 2), EXT_HEIGHT / 2, -2);
    extension.castShadow = true;
    extension.receiveShadow = true;
    barnGroup.add(extension);

    const extRoof = new THREE.Mesh(new THREE.PlaneGeometry(EXT_WIDTH + 0.5, EXT_DEPTH + 0.5), roofMaterial);
    extRoof.position.set(-(BARN_WIDTH / 2 + EXT_WIDTH / 2), EXT_HEIGHT + 0.05, -2);
    extRoof.rotation.x = -Math.PI / 2;
    extRoof.rotation.z = 0.2;
    extRoof.castShadow = true;
    barnGroup.add(extRoof);

    const chimney3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), roofMaterial);
    chimney3.position.set(-BARN_WIDTH/2 - EXT_WIDTH/2 + 1, EXT_HEIGHT + 1, -4);
    barnGroup.add(chimney3);

    // Tree and Bushes
    const foliageGroup = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a2b0f })
    );
    trunk.position.y = 4;
    const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(4, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 })
    );
    leaves.position.y = 9;
    trunk.castShadow = true;
    leaves.castShadow = true;
    foliageGroup.add(trunk, leaves);
    
    // bushes
    for(let i=0; i<5; i++){
        const bush = new THREE.Mesh(
            new THREE.SphereGeometry(1 + Math.random() * 0.8, 6, 5),
            new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 })
        );
        bush.position.set(
            (Math.random() - 0.5) * 6,
            0.5 + Math.random() * 0.5,
            (Math.random() - 0.5) * 4
        );
        bush.scale.y = 0.7 + Math.random() * 0.3;
        bush.castShadow = true;
        foliageGroup.add(bush);
    }
    foliageGroup.position.set(-10, 0, 3);
    barnGroup.add(foliageGroup);

    barnGroup.position.z = -15;
    scene.add(barnGroup);

    // Start
    setupEventListeners();
    prevTime = performance.now();
    animate();
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function stopScene3D() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    removeEventListeners();
    window.removeEventListener('resize', onWindowResize);
    if(controls) {
        controls.dispose();
        controls = null;
    }
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    scene = null;
    camera = null;
    if (container) {
        container.style.display = 'none';
    }
}