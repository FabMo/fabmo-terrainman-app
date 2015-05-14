var Terrain = function(element, options) {
	this.element = element;
	this.options(options);
}

Terrain.prototype.options = function(options) {
	default_options = {
		width : 5.0,
		height : 5.0,
		cut_depth : 0.75,
		method : 'simplex2',
		resolution : 0.0625,
		scale : 1.0,
		pass_depth : 0.125,
		feedrate : 1.0,
		zpullup : 0.5
	};

	options = options || {};

	this.width = options.width || default_options.width;
	this.height = options.height || default_options.height;
	this.material_thickness = options.material_thickness || default_options.material_thickness;
	this.base_thickness = options.base_thickness || default_options.base_thickness;
	this.cut_depth = options.cut_depth;
	this.method = options.method || default_options.method;
	this.resolution = options.resolution || default_options.resolution;
	this.scale = options.scale || default_options.scale;
	this.feedrate = options.feedrate || default_options.feedrate;
	this.pass_depth = options.pass_depth || default_options.pass_depth;
	this.zpullup = options.zpullup || default_options.zpullup;

}

Terrain.prototype.generate3D = function(seed) {
	seed = seed || Math.random();
	noise.seed(seed);
	var geometry = new THREE.PlaneGeometry( this.width, this.height, this.width/this.resolution, this.height/this.resolution );
	var terrain_scale = 1.0/this.scale;
	
	//set height of plane vertices
	for ( var i = 0; i<geometry.vertices.length; i++ ) {
		var x = geometry.vertices[i].x;
		var y = geometry.vertices[i].y;
		var z = this.cut_depth*noise.simplex2(terrain_scale*x,terrain_scale*y);
		geometry.vertices[i].z = z;
	}
	return geometry
}

Terrain.prototype.generateGCode = function(seed) {
	var do_another_pass = true;
	var res = this.resolution;
	var scale = 1.0/this.scale;
	var gcodes = ['(Terrain File)', 'G90', 'G20', 'G0 Z' + this.zpullup.toFixed(3), 'G0 X0Y0', 'M4', 'G4 P3.0'];

	function move(x,y,z,fr) {
		return "G1 X" + Number(x).toFixed(4) + " Y" + Number(y).toFixed(4) + " Z" + Number(z).toFixed(4) + " F" + (fr*60.0).toFixed(4);
	};

	// Do the initial plunge pass on the first row
	var current_pass_depth = 0;
	var do_another_pass = true;
	var x = 0;
	var y = 0;
	var z = 0;
	var dir = 1.0;
	var pass = 0;
	while(do_another_pass) {
		console.log('initial pass ' + pass)
		do_another_pass = false;
		current_pass_depth -= this.pass_depth;
		while((dir > 0) ? x < this.width : x > 0) {
			console.log('Moving x: ' + x)
			var depth = -((this.cut_depth/2.0) + ((this.cut_depth/2.0)*noise.simplex2(scale*x, scale*y)));
			if(current_pass_depth < depth) {
				// If we bottom out, don't cut the pass depth, cut the actual contour of the terrain
				z = depth;
			} else {
				// If we failed to bottom out ever, make sure to do another pass
				z = current_pass_depth;
				do_another_pass = true;
			}
			gcodes.push(move(x,y,z,this.feedrate))
			x += dir*res;
		}
		dir = -dir;
		pass += 1;
	}

	y += res;

//	gcodes.push('G0Z' + this.zpullup.toFixed(3));
//	gcodes.push('G0X0Y0');
	// Iterate over rows, then columns
	while(y <this.height) {
		while((dir > 0) ? x < this.width : x > 0) {
			// Calculate the Z (contour) at this point
			z = -((this.cut_depth/2.0) + ((this.cut_depth/2.0)*noise.simplex2(scale*x, scale*y)));
			gcodes.push(move(x,y,z,this.feedrate))
			x += dir*res;
		}
		y += res;
		dir = -dir;
	}

	gcodes.push('G0Z' + this.zpullup.toFixed(3));
	gcodes.push('M8');
	gcodes.push('G0X0Y0');

	return gcodes.join('\n');
}
