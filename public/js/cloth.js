import * as THREE from '../three/three.module.js';
// import Stats from './jsm/libs/stats.module.js';
// import { GUI } from './jsm/libs/dat.gui.module.js';
// import { OrbitControls } from './jsm/controls/OrbitControls.js';
/*
 * Cloth Simulation using a relaxed constraints solver
 */
// Suggested Readings
// Advanced Character Physics by Thomas Jakobsen Character
// http://freespace.virgin.net/hugo.elias/models/m_cloth.htm
// http://en.wikipedia.org/wiki/Cloth_modeling
// http://cg.alexandra.dk/tag/spring-mass-system/
// Real-time Cloth Animation http://www.darwin3d.com/gamedev/articles/col0599.pdf
window.scene = {};
var params = {
	enableWind: true,
	showBall: false,
	tooglePins: togglePins
};
var DAMPING = 0.03;
var DRAG = 1 - DAMPING;
var MASS = 0.1;
var restDistance = 50;
var xSegs = 10;
var ySegs = 10;
var clothFunction = plane( restDistance * xSegs, restDistance * ySegs );
var cloth = new Cloth( xSegs, ySegs );
var GRAVITY = 981 * 2.4;
var gravity = new THREE.Vector3( 0, - GRAVITY, 0 ).multiplyScalar( MASS );
var TIMESTEP = 18 / 6000;
var TIMESTEP_SQ = TIMESTEP * TIMESTEP;
var pins = [];
var windForce = new THREE.Vector3( 0, 0, 0 );
var ballPosition = new THREE.Vector3( 0, - 45, 0 );
var ballSize = 60; //40
var tmpForce = new THREE.Vector3();
var lastTime;

function plane( width, height ) {
	return function ( u, v, target ) {
		var x = ( u - 0.5 ) * width;
		var y = ( v + 0.5 ) * height;
		var z = 0;
		target.set( x, y, z );
	};
}
function Particle( x, y, z, mass ) {
	this.position = new THREE.Vector3();
	this.previous = new THREE.Vector3();
	this.original = new THREE.Vector3();
	this.a = new THREE.Vector3( 0, 0, 0 ); // acceleration
	this.mass = mass;
	this.invMass = 1 / mass;
	this.tmp = new THREE.Vector3();
	this.tmp2 = new THREE.Vector3();
	// init
	clothFunction( x, y, this.position ); // position
	clothFunction( x, y, this.previous ); // previous
	clothFunction( x, y, this.original );
}
// Force -> Acceleration
Particle.prototype.addForce = function ( force ) {
	this.a.add(
		this.tmp2.copy( force ).multiplyScalar( this.invMass )
	);
};
// Performs Verlet integration
Particle.prototype.integrate = function ( timesq ) {
	var newPos = this.tmp.subVectors( this.position, this.previous );
	newPos.multiplyScalar( DRAG ).add( this.position );
	newPos.add( this.a.multiplyScalar( timesq ) );
	this.tmp = this.previous;
	this.previous = this.position;
	this.position = newPos;
	this.a.set( 0, 0, 0 );
};
var diff = new THREE.Vector3();
function satisfyConstraints( p1, p2, distance ) {
	diff.subVectors( p2.position, p1.position );
	var currentDist = diff.length();
	if ( currentDist === 0 ) return; // prevents division by 0
	var correction = diff.multiplyScalar( 1 - distance / currentDist );
	var correctionHalf = correction.multiplyScalar( 0.5 );
	p1.position.add( correctionHalf );
	p2.position.sub( correctionHalf );
}
function Cloth( w, h ) {
	w = w || 10;
	h = h || 10;
	this.w = w;
	this.h = h;
	var particles = [];
	var constraints = [];
	var u, v;
	// Create particles
	for ( v = 0; v <= h; v ++ ) {
		for ( u = 0; u <= w; u ++ ) {
			particles.push(
				new Particle( u / w, v / h, 0, MASS )
			);
		}
	}
	// Structural
	for ( v = 0; v < h; v ++ ) {
		for ( u = 0; u < w; u ++ ) {
			constraints.push( [
				particles[ index( u, v ) ],
				particles[ index( u, v + 1 ) ],
				restDistance
			] );
			constraints.push( [
				particles[ index( u, v ) ],
				particles[ index( u + 1, v ) ],
				restDistance
			] );
		}
	}
	for ( u = w, v = 0; v < h; v ++ ) {
		constraints.push( [
			particles[ index( u, v ) ],
			particles[ index( u, v + 1 ) ],
			restDistance
		] );
	}
	for ( v = h, u = 0; u < w; u ++ ) {
		constraints.push( [
			particles[ index( u, v ) ],
			particles[ index( u + 1, v ) ],
			restDistance
		] );
	}
	// While many systems use shear and bend springs,
	// the relaxed constraints model seems to be just fine
	// using structural springs.
	// Shear
	// var diagonalDist = Math.sqrt(restDistance * restDistance * 2);
	// for (v=0;v<h;v++) {
	// 	for (u=0;u<w;u++) {
	// 		constraints.push([
	// 			particles[index(u, v)],
	// 			particles[index(u+1, v+1)],
	// 			diagonalDist
	// 		]);
	// 		constraints.push([
	// 			particles[index(u+1, v)],
	// 			particles[index(u, v+1)],
	// 			diagonalDist
	// 		]);
	// 	}
	// }
	this.particles = particles;
	this.constraints = constraints;
	function index( u, v ) {
		return u + v * ( w + 1 );
	}
	this.index = index;
}
function simulate( time ) {
	if ( ! lastTime ) {
		lastTime = time;
		return;
	}
	var i, j, il, particles, particle, constraints, constraint;
	// Aerodynamics forces
	if ( params.enableWind ) {
		var indx;
		var normal = new THREE.Vector3();
		var indices = clothGeometry.index;
		var normals = clothGeometry.attributes.normal;
		particles = cloth.particles;
		for ( i = 0, il = indices.count; i < il; i += 3 ) {
			for ( j = 0; j < 3; j ++ ) {
				indx = indices.getX( i + j );
				normal.fromBufferAttribute( normals, indx );
				tmpForce.copy( normal ).normalize().multiplyScalar( normal.dot( windForce ) );
				particles[ indx ].addForce( tmpForce );
			}
		}
	}
	for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {
		particle = particles[ i ];
		particle.addForce( gravity );
		particle.integrate( TIMESTEP_SQ );
	}
	// Start Constraints
	constraints = cloth.constraints;
	il = constraints.length;
	for ( i = 0; i < il; i ++ ) {
		constraint = constraints[ i ];
		satisfyConstraints( constraint[ 0 ], constraint[ 1 ], constraint[ 2 ] );
	}
	// Ball Constraints
	ballPosition.z = - Math.sin( Date.now() / 600 ) * 90; //+ 40;
	ballPosition.x = Math.cos( Date.now() / 400 ) * 70;
	if ( params.showBall ) {
		sphere.visible = true;
		for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {
			particle = particles[ i ];
			var pos = particle.position;
			diff.subVectors( pos, ballPosition );
			if ( diff.length() < ballSize ) {
				// collided
				diff.normalize().multiplyScalar( ballSize );
				pos.copy( ballPosition ).add( diff );
			}
		}
	} else {
		sphere.visible = false;
	}
	// Floor Constraints
	for ( particles = cloth.particles, i = 0, il = particles.length; i < il; i ++ ) {
		particle = particles[ i ];
		pos = particle.position;

	}
	// Pin Constraints
	for ( i = 0, il = pins.length; i < il; i ++ ) {
		var xy = pins[ i ];
		var p = particles[ xy ];
		p.position.copy( p.original );
		p.position.y -= 10;
		p.previous.copy( p.original );
		p.previous.y -= 10;
	}
}
/* testing cloth simulation */
var pinsFormation = [];
var pins = [ 6 ];
pinsFormation.push( pins );
pins = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
pinsFormation.push( pins );
pins = [ 0 ];
pinsFormation.push( pins );
pins = []; // cut the rope ;)
pinsFormation.push( pins );
pins = [ -60, cloth.w ]; // classic 2 pins
pinsFormation.push( pins );
pins = pinsFormation[ 1 ];
function togglePins() {
	pins = pinsFormation[ ~ ~ ( Math.random() * pinsFormation.length ) ];
}
var container, stats;
var camera, scene, renderer;
var clothGeometry;
var sphere;
var object1;
var object2;
init();
animate();



function init() {
	container = document.createElement( 'div' )
	container.className = 'threeD';
	document.body.appendChild( container );
	// scene
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0xcce0ff, 500, 10000 );
	// camera
	camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.set( 0, -800, 1000 );	
	// lights
	scene.add( new THREE.AmbientLight( 0x666666 ) );
	var light = new THREE.DirectionalLight( 0xFF8178, 3 );
	light.position.set( 50, 200, 100 );
	light.position.multiplyScalar( 1.3 );
	light.castShadow = true;
	light.shadow.mapSize.width = 1024;
	light.shadow.mapSize.height = 1024;
	var d = 300;
	light.shadow.camera.left = - d;
	light.shadow.camera.right = d;
	light.shadow.camera.top = d;
	light.shadow.camera.bottom = - d;
	light.shadow.camera.far = 1000;
	scene.add( light );
	// cloth material
	var loader = new THREE.TextureLoader();
	var clothTexture = loader.load( '../assets/textures/connection.png' );
	clothTexture.anisotropy = 16;
	var clothMaterial = new THREE.MeshPhongMaterial( {
		map: clothTexture,
		side: THREE.DoubleSide,
		alphaTest: 0.5
	} );
	// cloth geometry
	clothGeometry = new THREE.ParametricBufferGeometry( clothFunction, cloth.w, cloth.h );
	// cloth mesh
	object1 = new THREE.Mesh( clothGeometry, clothMaterial );	
	object1.position.set( 0, 100, 0 );
	object1.scale.y=1.4;
	object1.scale.x=1.4;
	object1.castShadow = true;
	scene.add( object1 );
	object1.customDepthMaterial = new THREE.MeshDepthMaterial( {
		depthPacking: THREE.RGBADepthPacking,
		map: clothTexture,
		alphaTest: 0.5
	} );
	camera.lookAt(new THREE.Vector3(object1.position.x, object1.position.y-100 , object1.position.z))

	// object2 = new THREE.Mesh( clothGeometry, clothMaterial );
	// object2.position.set( 0, 100, 0 );
	// object2.castShadow = true;
	// scene.add( object2 );
	// object2.customDepthMaterial = new THREE.MeshDepthMaterial( {
	// 	depthPacking: THREE.RGBADepthPacking,
	// 	map: clothTexture,
	// 	alphaTest: 0.5
	// } );
	// sphere
	var ballGeo = new THREE.SphereBufferGeometry( ballSize, 32, 16 );
	var ballMaterial = new THREE.MeshLambertMaterial();
	sphere = new THREE.Mesh( ballGeo, ballMaterial );
	sphere.castShadow = true;
	sphere.receiveShadow = true;
	sphere.visible = false;
	scene.add( sphere );
	// ground
	var groundTexture = loader.load( '../assets/textures/dove.jpg' );
	groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
	groundTexture.repeat.set( 25, 25 );
	groundTexture.anisotropy = 16;
	var groundMaterial = new THREE.MeshLambertMaterial( { map: groundTexture } );
	var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 40000, 40000 ), groundMaterial );
	mesh.position.y = - 250;
	mesh.rotation.x = - Math.PI / 2;
	mesh.receiveShadow = true;
	mesh.name = 'ground';
	window.scene.ground = mesh;
	scene.add( mesh );

	// renderer
	renderer = new THREE.WebGLRenderer( { antialias: true, alpha:true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.shadowMap.enabled = true;

	window.addEventListener( 'resize', onWindowResize, false );
	//
	// var gui = new GUI();
	// gui.add( params, 'enableWind' );
	// gui.add( params, 'showBall' );
	// gui.add( params, 'tooglePins' );
}
//
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}
//
function animate() {
	requestAnimationFrame( animate );
	var time = Date.now();
	var windStrength = Math.cos( time / 7000 ) * 200 + 40;
	windForce.set( 1000, Math.cos( time / 1000 ), Math.sin( time / 1000 ) );
	windForce.normalize();
	windForce.multiplyScalar( windStrength );
	simulate( time );
	// camera.lookAt(sphere.position);
	// window.scene.ground.lookAt(sphere.position);


	render(scene, camera);
	// stats.update();
}



function render() {
	var p = cloth.particles;
	for ( var i = 0, il = p.length; i < il; i ++ ) {
		var v = p[ i ].position;
		clothGeometry.attributes.position.setXYZ( i, v.x, v.y, v.z );
	}
	clothGeometry.attributes.position.needsUpdate = true;
	clothGeometry.computeVertexNormals();
	sphere.position.copy( ballPosition );
	renderer.render( scene, camera );
	camera.lookAt(new THREE.Vector3(sphere.position.x/10, object1.position.y-200 , object1.position.z))

}
