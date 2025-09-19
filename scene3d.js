import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Pathfinding } from 'pathfinding';

let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let animationFrameId = null;
let isInitializing = false;

const container = document.getElementById('scene-3d-container');
const canvas = document.getElementById('scene-3d-canvas');
const instructions = document.getElementById('scene-3d-instructions');

// Mobile controls state
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isDragging = false;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const PI_2 = Math.PI / 2;

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Tap-to-move state using three-pathfinding
let raycaster;
let pathfinder;
let navMesh;
let playerNavMeshGroup = -1;
let currentPath = null;
let tapIndicator;
let indicatorTimeout;

function setupEventListeners() {
    if (isMobile) {
        instructions.querySelector('div').textContent = 'Tap to move, Drag to look';
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd);
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
        // Note: click and control listeners are not removed to allow re-entry
    }
}

function onTouchStart(event) {
    event.preventDefault();
    if (!controls) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = performance.now();
    isDragging = false;
}

function onTouchMove(event) {
    event.preventDefault();
    if (!controls || event.touches.length === 0) return;
    isDragging = true;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    const playerObject = controls.getObject();
    euler.setFromQuaternion(playerObject.quaternion);

    euler.y -= deltaX * 0.002;
    euler.x -= deltaY * 0.002;
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

    playerObject.quaternion.setFromEuler(euler);
}

function onTouchEnd(event) {
    event.preventDefault();
    if (!controls) return;
    const touchDuration = performance.now() - touchStartTime;
    if (!isDragging && touchDuration < 250) {
        // It's a tap - use raycaster to set destination
        const touch = event.changedTouches[0];
        const mouse = new THREE.Vector2();
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = - (touch.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(navMesh); // Raycast against the navmesh

        if (intersects.length > 0) {
            const targetPosition = intersects[0].point;
            const player = controls.getObject();

            playerNavMeshGroup = pathfinder.getGroup('NAVMESH', player.position);
            const targetGroup = pathfinder.getGroup('NAVMESH', targetPosition);

            if (playerNavMeshGroup === targetGroup) { // Check if path is possible
                 currentPath = pathfinder.findPath(player.position, targetPosition, 'NAVMESH', playerNavMeshGroup);
                 if (currentPath && currentPath.length > 0) {
                    // Show tap indicator
                    tapIndicator.position.copy(targetPosition);
                    tapIndicator.position.y += 0.05; // Prevent z-fighting
                    tapIndicator.visible = true;
                    if (indicatorTimeout) clearTimeout(indicatorTimeout);
                    indicatorTimeout = setTimeout(() => {
                        tapIndicator.visible = false;
                    }, 500);
                 } else {
                    currentPath = null;
                 }
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

function checkCollision(nextPosition) {
    // This function is no longer needed for tap-to-move as pathfinding handles obstacles.
    // It could be kept for potential future use with desktop keyboard movement if needed.
    return false; 
}


function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    const player = controls.getObject();

    if (isMobile && currentPath && currentPath.length > 0) {
        const targetNode = currentPath[0];
        const directionToNode = targetNode.clone().sub(player.position);
        directionToNode.y = 0; // Move along the horizontal plane

        const distance = directionToNode.length();
        const moveSpeed = 4.0;
        const moveDistance = Math.min(distance, moveSpeed * delta);

        if (distance < 0.1) {
            // Reached the node, move to the next one
            currentPath.shift();
            if (currentPath.length === 0) {
                currentPath = null; // Path complete
                if (tapIndicator) tapIndicator.visible = false;
            }
        } else {
            // Move towards the current node
            player.position.add(directionToNode.normalize().multiplyScalar(moveDistance));

            // Smoothly rotate player to face movement direction
            const targetQuaternion = new THREE.Quaternion();
            const targetRotationMatrix = new THREE.Matrix4();
            targetRotationMatrix.lookAt(player.position.clone().add(directionToNode), player.position, player.up);
            targetQuaternion.setFromRotationMatrix(targetRotationMatrix);

            player.quaternion.slerp(targetQuaternion, 0.1);
        }

    } else if (!isMobile) { // Desktop controls
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
    
    // prevent flying up/down
    if (controls) {
        player.position.y = 1.7; 
    }

    prevTime = time;

    renderer.render(scene, camera);
}

// A wrapper for PointerLockControls to match our custom mobile controls' API
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
    dispose() { /* No-op */ }
}

// A wrapper for our custom touch controls
class MobileControls {
    constructor(camera) {
        this.playerObject = new THREE.Object3D();
        this.camera = camera;
        this.playerObject.add(this.camera);
    }
    getObject() {
        return this.playerObject;
    }
    moveForward(distance) {
        // This moves the object along its local Z axis
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.playerObject.quaternion);
        this.playerObject.position.add(forward.multiplyScalar(distance));
    }
    moveRight(distance) {
        this.playerObject.translateX(distance);
    }
    dispose() { /* No-op */ }
}

function createCollisionBoxes(object) {
    // No longer needed for pathfinding
}


export function initScene3D() {
    if (isInitializing) return;
    isInitializing = true;

    container.style.display = 'block';
    
    pathfinder = new Pathfinding();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    scene.fog = new THREE.Fog(0x111111, 0, 75);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Controls - conditional initialization
    if (isMobile) {
        controls = new MobileControls(camera);
        const player = controls.getObject();
        player.position.set(0, 1.7, 5);
        scene.add(player); // Add the player object to the scene for mobile
        
        if (instructions) instructions.classList.remove('hidden');
        raycaster = new THREE.Raycaster();
    } else {
        controls = new DesktopControls(camera, document.body);
        camera.position.y = 1.7; // set initial height for camera inside PLC object
        scene.add(controls.getObject());
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
    dirLight.position.set(-15, 20, -5); // Angled from front-left
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

    // Ground (visual only)
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.8, metalness: 0.2 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);


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
    extRoof.rotation.z = 0.2; // slight slope
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
    
    // Navigation Mesh Generation
    const navMeshGeometry = new THREE.PlaneGeometry(200, 200, 40, 40);
    const navMeshMatrix = new THREE.Matrix4();
    navMeshMatrix.makeRotationX(-Math.PI / 2);
    navMeshGeometry.applyMatrix4(navMeshMatrix);

    const barnBox = new THREE.Box3().setFromObject(barnGroup);
    barnBox.min.y = -Infinity; // Make sure it culls through the plane
    barnBox.max.y = Infinity;

    const navPositions = navMeshGeometry.attributes.position;
    const navVerts = [];
    for (let i = 0; i < navPositions.count; i++) {
        navVerts.push(new THREE.Vector3().fromBufferAttribute(navPositions, i));
    }

    const culledIndices = [];
    for (let i = 0; i < navVerts.length; i += 3) {
        const v1 = navVerts[i];
        const v2 = navVerts[i + 1];
        const v3 = navVerts[i + 2];
        const faceCenter = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);
        if (barnBox.containsPoint(faceCenter)) {
            culledIndices.push(i, i + 1, i + 2);
        }
    }

    navMeshGeometry.setIndex(
      navMeshGeometry.index.array.filter((_, i) => !culledIndices.includes(i))
    );
    navMeshGeometry.deleteAttribute('normal');
    navMeshGeometry.deleteAttribute('uv');
    navMeshGeometry.computeVertexNormals();
    
    const navZone = Pathfinding.createZone(navMeshGeometry);
    pathfinder.setZoneData('NAVMESH', navZone);
    
    navMesh = new THREE.Mesh(navMeshGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }));
    navMesh.visible = false; // Set to true for debugging
    scene.add(navMesh);


    // Tap indicator for mobile
    if (isMobile) {
        const indicatorGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
        indicatorGeometry.rotateX(-Math.PI / 2);
        const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 });
        tapIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        tapIndicator.visible = false;
        scene.add(tapIndicator);
    }

    // Start
    setupEventListeners();
    prevTime = performance.now();
    animate();
    window.addEventListener('resize', onWindowResize);
    isInitializing = false;
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