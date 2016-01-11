var vm = null;
var yelp = function(){
	//https://discussions.udacity.com/t/im-having-trouble-getting-started-using-apis/13597/2
	var nonce_generate = function() {
		return (Math.floor(Math.random() * 1e12).toString());
	};

	var yelp_url='http://api.yelp.com/v2/search';
	var parameters = {
		oauth_consumer_key: "c3k72t_lDi5ni3GVAnY5DA",
		oauth_token: "dkQ5ow9kZ70xbg-94TpFPyGWeaBAssPU",
		oauth_nonce: nonce_generate(),
		oauth_timestamp: Math.floor(Date.now()/1000),
		oauth_signature_method: 'HMAC-SHA1',
		oauth_version : '1.0',
		callback: 'cb',              // This is crucial to include for jsonp implementation in AJAX or else the oauth-signature will be wrong.
		location: 'Canal Street New York',
		term: 'food drink',
		limit: 8
	};

	var  YELP_KEY_SECRET = "1Ab9HjsAQau_X4x02wncMmD-67w";
	var YELP_TOKEN_SECRET="cB4aqsRzJh8nKZRwKyy6FIDT_UQ";
	var encodedSignature = oauthSignature.generate('GET',yelp_url, parameters, YELP_KEY_SECRET, YELP_TOKEN_SECRET);

	parameters.oauth_signature = encodedSignature;

	var settings = {
		url: yelp_url,
		data: parameters,
		cache: true,                // This is crucial to include as well to prevent jQuery from adding on a cache-buster parameter "_=23489489749837", invalidating our oauth-signature
		dataType: 'jsonp',

		success: function(results) {
			var initialPlaces =results.businesses;
			vm = new viewModel(initialPlaces);
			ko.applyBindings(vm);
		},
		error: function() {
			console.log("fail");
			alert("yelp data was not successful");
		}
	};

	this.init = function(){
		$.ajax(settings);
	};

};
new yelp().init();


var place= function(data){
	this.name = ko.observable(data.name);
	var address_1 = data.location.address[0] ? data.location.address[0]+" " : "";
	var address_2 = data.location.address[1] ? data.location.address[1]+" " : "";
	var imageUrl = data.image_url.replace("ms","l");

	this.address = ko.observable(address_1 + address_2 + data.location.city);
	this.location = ko.observable (data.location);
	this.image= ko.observable(imageUrl);
	this.maker =null;
	this.infowindow =null;
	this.phone = ko.observable(data.phone);
};


// stores current search and current select store
var storage = function(vm){
	console.log("initialPlaces");
	if (!localStorage.searchStore) {
		localStorage.searchStore = ko.toJSON("");
	}
	if (!localStorage.currentStore) {
		localStorage.currentStore = ko.toJSON("");
	}
	this.searchStore = function(data){
		if (!data){
			return JSON.parse(localStorage.searchStore);
		}
		localStorage.searchStore = ko.toJSON(data);
	};
	this.currentStr = function(data){
		if (!data){
			console.log("test");
			return JSON.parse(localStorage.currentStore);
		}

		var tempCurrent ={
			name : data.name(),
			address : data.address(),
			phone: data.phone(),
			image : data.image()
		};
		//ko.toJson(data) gives error
		localStorage.currentStore = ko.toJSON(tempCurrent);
	};
};

var viewModel = function(initialPlaces){
	var self = this;
	var vmStorage = new storage(self);

	self.placeList = ko.observableArray([]);
	initialPlaces.forEach(function(item){
		self.placeList.push(new place(item));
	});

	console.log(vmStorage.searchStore());
	self.filter = ko.observable(vmStorage.searchStore());

	console.log(vmStorage.currentStr());
	self.currentPlace = ko.observable(vmStorage.currentStr());


	self.filterPlaces = ko.computed(function(){
		//http://www.knockmeout.net/2011/04/utility-functions-in-knockoutjs.html
		vmStorage.searchStore(self.filter());
		var filter= self.filter().toLowerCase();
		if(!filter){
			return self.placeList();

		}
		else{
			var filterList = ko.utils.arrayFilter(self.placeList(), function(item) {
						return item.name().toLowerCase().indexOf(filter) !== -1;
			});
			console.log(filterList);
			if (filterList.length === 0){
				vmStorage.searchStore("");
			}
			return filterList;
		}

	});
	self.setCurrent =function(data){
		self.currentPlace(data);
		vmStorage.currentStr(self.currentPlace());
		goo.markerShowInfo(data);
	};

	self.markerInfo = function(){
		self.setCurrent (this);
	};

	var goo = new googleMaps(self);
	goo.initMap();

};






var googleMaps = function(data){
	var self = this;
	var gMap;
	var placeList = data.placeList();
	var filterPlaces = data.filterPlaces();

	console.log(placeList);
	self.initMap =function(){
		gMap = new google.maps.Map(document.getElementById('map-canvas'), {
			zoom: 12,
		});
		var geocoder = new google.maps.Geocoder();
		var latlngbounds = new google.maps.LatLngBounds();
		self.geocodeAddress(geocoder, latlngbounds);

		data.filterPlaces.subscribe(function (newValue) {
			placeList.forEach(function(item){
				self.showMarker(item,self.checkShowMarker(item, newValue));
			});
		});
	//placeList.notifySubscribers();
	}; // end self.initMap


	self.showMarker= function(item, val){
		if (val){
			item.marker.setMap(gMap);
		}
		else{
			item.marker.setMap(null);
		}
	};

	self.checkShowMarker = function(place, placeArray){
		return (jQuery.inArray(place,placeArray)!== -1) ? true: false;
	};


	self.geocodeAddress= function (geocoder, llbound ) {
		var show =null;
		placeList.forEach(function(item){
			geocoder.geocode({'address': item.address()}, function(results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					llbound.extend(results[0].geometry.location);
					self.createMarker(results[0],item, self.checkShowMarker(item, filterPlaces) );
				}
				else {
					alert('Geocode was not successful for the following reason: ' + status);
				}
				gMap.fitBounds(llbound);
			});

		});
	};// end self.geocodeAddress


	self.createMarker= function (place,item,show){
		var marker = new google.maps.Marker({
			map: show ? gMap :null,
			position: place.geometry.location,
			animation: google.maps.Animation.DROP,
			icon: {
				//path: google.maps.SymbolPath.BACKWARD_OPEN_ARROW,
				//scale: 4,
				//strokeWeight: 6,
				strokeColor : 'gray'
			}

		});

		var contentString = '<div>'+ item.name()+'</div';
		var infowindow = new google.maps.InfoWindow({content: contentString});

		item.marker = marker;
		item.infowindow = infowindow;

		marker.addListener('click',function(){
			data.setCurrent(item);
		},marker);

	};//end self.createMarker


	self.markerShowInfo =function (item){
			placeList.forEach(function(item){
				item.infowindow.close();
			});

			item.infowindow.open(gMap,item.marker);
			item.marker.setAnimation(google.maps.Animation.DROP);
			item.marker.icon.strokeColor ('gray');
	}; //end self.markerShowInfo

};// end var googleMaps



