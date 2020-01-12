			var camera, scene, renderer;
			var geometry, material, mesh;
			var mouse = new THREE.Vector2();
			var target = new THREE.Vector2()
			var W = window.innerWidth, H = window.innerHeight;
			var windowHalf = THREE.Vector2(W/2,H/2);

			function setup() {
				
				renderer = new THREE.WebGLRenderer();
				renderer.setSize( W, H );
				document.body.appendChild( renderer.domElement );

				camera = new THREE.PerspectiveCamera( 50, W/H, 1, 10000 );
				camera.position.z = 400;

				scene = new THREE.Scene();
				
				
				geometry = new THREE.PlaneGeometry(100, 200, 10, 20);
				material = new THREE.MeshNormalMaterial({shading: THREE.FlatShading, wireframe: false, wireframeLinewidth: 1});
				
				//morphing
				for ( var i = 0; i < geometry.vertices.length; i ++ ) {
					var vertices = [];
					for ( var v = 0; v < geometry.vertices.length; v ++ ) {
						vertices.push( geometry.vertices[ v ].clone() );
						if ( v === i ) {
							vertices[ vertices.length - 1 ].x *= 2;
							vertices[ vertices.length - 1 ].y *= 2;
							vertices[ vertices.length - 1 ].z *= 2;
						}
					}
					geometry.morphTargets.push( { name: "target" + i, vertices: vertices } );
				}
				//morphing^
				
				mesh = new THREE.Mesh(geometry, material);
				//morphing
				mesh.material.morphTargets = true;
				//morphing^
				scene.add(mesh);


			}
			
			function onMouseMove( event ) {

				mouse.x = ( event.clientX - windowHalf.x );
				mouse.y = ( event.clientY - windowHalf.x );

			}

			function draw() {

				//requestAnimationFrame( draw );
				
				for(var v = 0; v < mesh.geometry.vertices.length; v ++ ){
					mesh.morphTargetInfluences[ v ] = Math.random();
				}
				
				
				
				target.x = ( 1 - mouse.x ) * 0.002;
				target.y = ( 1 - mouse.y ) * 0.002;
  
			  	camera.rotation.x += 0.05 * ( target.y - camera.rotation.x );
			  	camera.rotation.y += 0.05 * ( target.x - camera.rotation.y );

				renderer.render( scene, camera );
				setTimeout(function(){draw()},50);
			}

			setup();
			draw();