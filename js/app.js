if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

var container, stats;
var camera, scene, renderer;
var projector, plane, cube;
var mouse2D, mouse3D, raycaster,
rollOveredFace, isShiftDown = false,
theta = 45 * 0.5, isCtrlDown = false;

var rollOverMesh, rollOverMaterial;
var voxelPosition = new THREE.Vector3();
var tmpVec = new THREE.Vector3();
var normalMatrix = new THREE.Matrix3();
var cubeGeo, cubeMaterial;
var currentMaterial;
var i, intersector;

var zoom = 1000;

var objects = [];

var voxels = [
  [0xfeb74c, 0x00ff80, "textures/square-outline-textured.png"],
  [0x00b74c, 0x00ff80, "textures/square-outline-textured2.png"],
  [0xffa72c, 0x00ff80, "textures/square-outline-textured3.png"],
  [0xeeeeee, 0x00ff80, "textures/square-outline-textured4.png"]
];

var materials = [];

_.each(voxels,function(i,indx){
  var mat = new THREE.MeshLambertMaterial({
    color: i[0],
    ambient: i[1],
    shading: THREE.FlatShading,
    map: THREE.ImageUtils.loadTexture( i[2] )
  });
  mat.ambient = mat.color;
  mat.name = "mat"+indx;
  materials.push(mat);
});

currentMaterial = materials[0];

var setCurrentMaterial = function(i){
  return function(e){
    $(".selected").removeClass("selected");
    $(this).addClass("selected");
    e.stopPropagation();
    e.preventDefault();
    currentMaterial = materials[i];
    return false;
  };
};

function createVoxelGui(container) {
  var top = 10;
  _.each(voxels,function(i,indx){
    var img = $("<img />");
    img.attr("src",i[2]);
    img.addClass("tile");
    img.css({
      position: 'absolute',
      top: top,
      left: 10
    });
    top += 22;
    img.click(setCurrentMaterial(indx));
    $(container).append(img);
  });
  $(container).find(".tile").first().addClass("selected");
}

init();
animate();

function init() {

  container = document.createElement( 'div' );
  document.body.appendChild( container );

  var info = document.createElement( 'div' );
  info.style.position = 'absolute';
  info.style.top = '10px';
  info.style.width = '100%';
  info.style.textAlign = 'center';
  info.innerHTML =
    '<strong>click</strong>: add voxel, '+
    '<strong>shift + click</strong>: remove voxel, '+
    '<strong>control</strong>: rotate';
  container.appendChild( info );

  createVoxelGui(container);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.y = 800;

  scene = new THREE.Scene();
  // scene.fog = new THREE.FogExp2( 0xffffff, 0.0004 );

  // roll-over helpers

  rollOverGeo = new THREE.BoxGeometry( 50, 50, 50 );
  rollOverMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    opacity: 0.5,
    transparent: true
  });
  rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
  scene.add( rollOverMesh );

  // cubes

  cubeGeo = new THREE.BoxGeometry( 50, 50, 50 );

  // picking

  projector = new THREE.Projector();

  // grid

  var size = 5000, step = 50;

  var geometry = new THREE.Geometry();

  for ( var i = - size; i <= size; i += step ) {

    geometry.vertices.push( new THREE.Vector3( - size, 0, i ) );
    geometry.vertices.push( new THREE.Vector3(   size, 0, i ) );

    geometry.vertices.push( new THREE.Vector3( i, 0, - size ) );
    geometry.vertices.push( new THREE.Vector3( i, 0,   size ) );

  }

  var material = new THREE.LineBasicMaterial({
    color: 0x000000,
    opacity: 0.2,
    transparent: true
  });

  var line = new THREE.Line( geometry, material );
  line.type = THREE.LinePieces;
  scene.add( line );

  plane = new THREE.Mesh(
    new THREE.PlaneGeometry( 5000, 5000 ),
    new THREE.MeshBasicMaterial()
  );
  plane.rotation.x = - Math.PI / 2;
  plane.visible = false;
  scene.add( plane );

  objects.push( plane );

  mouse2D = new THREE.Vector3( 0, 10000, 0.5 );

  // Lights

  var ambientLight = new THREE.AmbientLight( 0x606060 );
  scene.add( ambientLight );

  var directionalLight = new THREE.DirectionalLight( 0xffffff );
  directionalLight.position.set( 1, 0.75, 0.5 ).normalize();
  scene.add( directionalLight );

  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setClearColor( 0xf0f0ff );
  renderer.setSize( window.innerWidth, window.innerHeight );

  container.appendChild( renderer.domElement );

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.bottom = '0px';
  stats.domElement.style.right = '0px';
  container.appendChild( stats.domElement );

  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  $(document).click(onDocumentMouseDown);
  document.addEventListener( 'keydown', onDocumentKeyDown, false );
  document.addEventListener( 'keyup', onDocumentKeyUp, false );
  document.addEventListener( 'mousewheel', onMouseScroll, false );

  //

  window.addEventListener( 'resize', onWindowResize, false );

}

function onMouseScroll(e) {
  // cross-browser wheel delta
  var e = window.event || e; // old IE support
  var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
  zoom += delta*15;
  if(zoom<0) {
    zoom = 0;
  }
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function getRealIntersector( intersects ) {

  for( i = 0; i < intersects.length; i++ ) {

    intersector = intersects[ i ];

    if ( intersector.object != rollOverMesh ) {

      return intersector;

    }

  }

  return null;

}

function setVoxelPosition( intersector ) {

  if ( intersector.face === null ) {

    console.log( intersector )

  }

  normalMatrix.getNormalMatrix( intersector.object.matrixWorld );

  tmpVec.copy( intersector.face.normal );
  tmpVec.applyMatrix3( normalMatrix ).normalize();

  voxelPosition.addVectors( intersector.point, tmpVec );
  voxelPosition.divideScalar( 50 ).floor().multiplyScalar( 50 ).addScalar( 25 );

}

function onDocumentMouseMove( event ) {

  event.preventDefault();

  mouse2D.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse2D.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

}

function onDocumentMouseDown( event ) {

  event.preventDefault();

  var intersects = raycaster.intersectObjects( objects );

  if ( intersects.length > 0 ) {

    intersector = getRealIntersector( intersects );

    // delete cube

    if ( isShiftDown ) {

      if ( intersector.object != plane ) {

        scene.remove( intersector.object );

        objects.splice( objects.indexOf( intersector.object ), 1 );

      }

    // create cube

    } else {

      intersector = getRealIntersector( intersects );
      setVoxelPosition( intersector );

      var voxel = new THREE.Mesh( cubeGeo, currentMaterial );
      voxel.position.copy( voxelPosition );
      voxel.matrixAutoUpdate = false;
      voxel.updateMatrix();
      scene.add( voxel );

      objects.push( voxel );

    }

  }
}

function onDocumentKeyDown( event ) {

  switch( event.keyCode ) {

    case 16: isShiftDown = true; break;
    case 17: isCtrlDown = true; break;

  }

}

function onDocumentKeyUp( event ) {

  switch ( event.keyCode ) {

    case 16: isShiftDown = false; break;
    case 17: isCtrlDown = false; break;

  }

}

//

function animate() {

  requestAnimationFrame( animate );

  render();
  stats.update();

}

function serialize() {
  var ret = [];
  _.each(objects,function(i){
    var type = i.material.name.slice(3);
    console.log(type)
    if(type!=='') {
      ret.push({
        x:i.position.x/25,
        y:i.position.y/25,
        z:i.position.z/25,
        m:parseInt(type,10)
      });
    }
  });
  return ret;
}

function deserialize(json) {
  _.each(json,function(i){
    var voxel = new THREE.Mesh( cubeGeo, materials[i.m] );
    voxel.position.x = i.x*25;
    voxel.position.y = i.y*25;
    voxel.position.z = i.z*25;
    voxel.matrixAutoUpdate = false;
    voxel.updateMatrix();
    scene.add( voxel );

    objects.push( voxel );
  });
}

function clearScene() {
  var ret = [];
  _.each(objects,function(i){
    var type = i.material.name.slice(3);
    if(type!=='') {
      scene.remove(i);
    } else {
      ret.push(i);
    }
  });
  objects = ret;
}

var despx = 0;
var despy = 0;

function render() {

  if ( isCtrlDown ) {

    theta += mouse2D.x * 1.5;

  }

  raycaster = projector.pickingRay( mouse2D.clone(), camera );

  var intersects = raycaster.intersectObjects( objects );

  if ( intersects.length > 0 ) {

    intersector = getRealIntersector( intersects );

    if ( intersector ) {

      setVoxelPosition( intersector );
      rollOverMesh.position = voxelPosition;

    }

  }

  camera.position.x = 1400 * Math.sin( THREE.Math.degToRad( theta ) )+despx;
  camera.position.z = 1400 * Math.cos( THREE.Math.degToRad( theta ) )+despy;
  camera.position.y = zoom;

  var kk = scene.position.clone();
  kk.x+=despx;
  kk.z+=despy;

  camera.lookAt( kk );

  renderer.render( scene, camera );

}
