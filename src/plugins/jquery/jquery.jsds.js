/*
 * Copyright (c) 2010 Matthew A. Taylor
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

JSDS = {

	_stores: {},
	_listeners: {},
	
	/**
	 * Create a new data store object. If no id is specified, a random id will be 
	 * generated.
	 *
	 * id {String} (optional): to identify this store for events and later retrieval 
	 */
	create: function(id) {
		
		var jsds = this;
		
		id = id || _randomId();
		
		if (this._stores[id]) {
			throw new Error('Cannot overwrite existing data store "' + id + '"!');
		}

		function _randomId() {
			var text = "",
				i=0,
				possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
			for(; i < 10; i++ ) {
				text += possible.charAt(Math.floor(Math.random() * possible.length));
			}
			return text;
		}
		
		/************************************************************************
		/* The JSDataStore class 
		/************************************************************************/
		function JSDataStore(id) {
			this._s = {};
			this._l = {};
			this.id = id;
		}
		
		/**
		 * Stores data
		 *
		 * key {String}: the key to be used to store the data. The same key can be used to retrieve
		 *               the data
		 * val {Object}: Any value to be stored in the store
		 * opts {Object} (optional): options to be used when storing data:
		 *                          'update': if true, values already existing within objects and
		 *                                    arrays will not be clobbered
		 * returns {Object}: The last value stored within specified key or undefined
		 *
		 * (fires 'store' event)
		 */
		JSDataStore.prototype.store = function(key, val, opts /*optional*/) {
			var i, firstKey, result;
			opts = opts || { update: false };
			
			// internal recursive store function
			function _store(store, key, val, oldVal /*optional*/) {
				var result, keys, oldKey;
				if (key.indexOf('\.') >= 0) {
					keys = key.split('.');
					oldVal = store[keys[0]] ? _clone(store[keys[0]]) : undefined;
					oldKey = keys.shift();
					if (store[oldKey] === undefined) {
					    store[oldKey] = {};
					}
					return _store(store[oldKey], keys.join('.'), val, oldVal);
				}
				result = oldVal ? oldVal[key] : store[key];
				// if this is an update, and there is an old value to update
				if (opts.update) {
				    _update(store, val, key);
				} 
				// if not an update, just overwrite old value
				else {
    				store[key] = val;
				}
				return result;
			}
			
			result = _store(this._s, key, val);
			
			_fire.call(this, 'store', {key: key, value: val, id: this.id});
			return result;
		};
		
		/**
		 * Gets data back out of store
		 *
		 * key {String}: the key of the data you want back
		 * returns {Object}: the data or undefined if key doesn't exist
		 *
		 * (fires 'get' event)
		 */
		JSDataStore.prototype.get = function(key) {
			var s = this._s, keys, i=0, j=0, v, result;
			
			if (arguments.length === 1 && key.indexOf('\.') < 0) {
				result = s[key];
			} else {
				if (arguments.length > 1) {
					keys = [];
					for (i=0; i<arguments.length; i++) {
						if (arguments[i].indexOf('\.') > -1) {
							var splitKeys = arguments[i].split('\.');
							for (j=0; j<splitKeys.length; j++) {
								keys.push(splitKeys[j]);
							}
						} else {
							keys.push(arguments[i]);
						}
					}
				} else if (key.indexOf('\.') > -1) {
					keys = key.split('\.');
				}

				result = _getValue(s, keys);
			}
			
			_fire.call(this, 'get', {key:key, value:result});
			return result;
		};
		/**
		 * Adds a listener to this store. The listener will be executed when an event of 
		 * the specified type is emitted and all the conditions defined in the parameters
		 * are met.
		 *
		 * There are 2 options for how parameters are passed into this function:
		 * 
		 * OPTION 1
		 * type {String}: the type of event to listen for ('store', 'get', 'clear', etc.)
		 * fn {function}: function to be executed on event
		 * scope {object}: object to use as the scope of the callback
		 * 
		 * OPTION 2
		 * type {String}: the type of event to listen for ('store', 'get', 'clear', etc.)
 		 * options {object}: an object that contains one or more of the following configurations:
 		 *                  'callback': the function to be executed
 		 *                  'scope': the scope object for the callback execution
 		 *                  'key': the storage key to listen for. If specified only stores into this key will
 		 *                          cause callback to be executed
		 */
		JSDataStore.prototype.on = function() {
			var type = arguments[0], fn, scope, pname, key;
			if (typeof arguments[1] === 'object') {
				fn = arguments[1].callback;
				scope = arguments[1].scope;
				if (arguments[1].key) {
					key = arguments[1].key;
				}
			} else {
				fn = arguments[1];
				scope = arguments[2];
			}
			if (!this._l[type]) {
				this._l[type] = [];
			}
			scope = scope || this;
			this._l[type].push({callback:fn, scope:scope, key: key});
			return this; // allow chaining
		};
		
		/**
		 * Removes all data from store
		 *
		 * (fires 'clear' event)
		 */
		JSDataStore.prototype.clear = function() {
			this._s = {};
			_fire.call(this, 'clear');
		};
		
		/**
		 * Removes all internal references to this data store. Note that to entirely release
		 * store object for garbage collection, you must also set any local references to the
		 * store to null!
		 *
		 * (fires 'remove' and 'clear' events)
		 */
		JSDataStore.prototype.remove = function() {
		    var ltype, optsArray, opts, i;
			this.clear();
			for (ltype in JSDS._listeners) {
		        if (JSDS._listeners.hasOwnProperty(ltype)) {
		            optsArray = JSDS._listeners[ltype];
		            for (i=0; i<optsArray.length; i++) {
		                opts = optsArray[i];
		                if (!opts.id || opts.id === this.id) {
                    		optsArray.splice(i,1);
		                }
		            }
		        }
		    }
			delete jsds._stores[this.id];
			_fire.call(this, 'remove');
		};
		
		// recursive update function used to overwrite values within the store without 
		// clobbering properties of objects
		function _update(store, val, key) {
		    var i, vprop, tmpKeys, newUKey, valProp;
		    if (typeof val !== 'object' || val instanceof Array) {
		        if (store[key] && val instanceof Array) {
		            _mergeArraysIntoSet(store[key], val);
		        } else {
    		        store[key] = val;
		        }
		    } else {
    		    for (vprop in val) {
    		        if (val.hasOwnProperty(vprop)) {
    		            if (!store[key]) {
    		                store[key] = {};
    		            }
    		            if (store[key].hasOwnProperty(vprop)) {
							_update(store[key], val[vprop], vprop);
    		            } else {
							store[key][vprop] = val[vprop];
    		            }
    		        }
    		    }
		    }
		}
		
		// merge two arrays without duplicate values
		function _mergeArraysIntoSet(lhs, rhs) {
		    var i=0;
		    for (; i<rhs.length; i++) {
		        if (!_arrayContains(lhs, rhs[i])) {
		            lhs.push(rhs[i]);
		        }
		    }
		}
		
		// internal utility function
		function _arrayContains(arr, val, comparator /* optional */) {
		    var i=0;
		    comparator = comparator || function(lhs, rhs) {
		        return lhs === rhs;
		    };
		    for (;i<arr.length;i++) {
		        if (comparator(arr[i], val)) {
		            return true;
		        }
		    }
		    return false;
		}
		
		// compares two arrays of keys together, returning true if haystack contains a value 
		// that needle also contains
		function _hasMatchingKey(haystack, needle) {
		    var i=0, match;
		    for (;i<needle.length; i++) {
		        match = _arrayContains(haystack, needle[i], function(lhs, rhs) {
		            console.log ('Matching ' + lhs + ' and ' + rhs);
					// if the wildcard is the first thing, change to .*
					if (rhs.indexOf('*') === 0) {
						rhs = '.' + rhs;
					}
		            return lhs.search(rhs) > -1;
		        });
		        if (match) {
		            return true;
		        }
		    }
		    return false;
		}
		
		// fire an event of 'type' with included arguments to be passed to listeners functions
		function _fire(type, args) {
			var i, opts, scope, listeners, pulledKeys,
			    localListeners = this._l[type] || [], 
			    staticListeners = JSDS._listeners[type] || [];
			    
			// mix local listeners
			listeners = localListeners.concat(staticListeners);
			
			if (listeners.length) {
				for (i=0; i<listeners.length; i++) {
					opts = listeners[i];
					if (_listenerApplies.call(this, opts, args)) {
		        		scope = opts.scope || this;
		        		if (opts.key && args) {
							if (opts.key.indexOf('*') >= 0) {
								pulledKeys = _pullOutKeys(args.value);
								args.value = {};
								args.value.key = args.key + pulledKeys;
								args.value.value = _getValue(this._s, args.value.key.split('.'));
							} else {
			        		    args.value = _getValue(this._s, opts.key.split('.'));
							}
	        		    }
		        		opts.callback.call(scope, type, args);    
		            }
				}
			}
		}
		
		function _listenerApplies(listener, crit) {
			var result = false, last, lastDot, sub, k, breakout = false;
			if (!listener.key || !crit) {
				return true; 
			}
			if (!listener.id || listener.id === this.id) {
				if (!crit.key || crit.key.match(_toRegex(listener.key))) {
					return true;
				}				
				last = crit.key.length;
				while (!breakout) {
					sub = crit.key.substr(0, last);
					last = sub.lastIndexOf('\.');
					if (last < 0) {  
						k = sub;
						breakout = true;
					} else {
						k = sub.substr(0, last);
					}
					//baseStore = _getValue(this._s, crit.key.split('.'));
					if (listener.key.indexOf('*') === 0) {
						return _valueMatchesKeyString(crit.value, listener.key.replace(/\*/, crit.key).substr(crit.key.length + 1));
					} else if (listener.key.indexOf('*') > 0) {
						var replacedKey = _getCompleteKey(crit);
						return _toRegex(replacedKey).match(listener.key);
					}
					return _valueMatchesKeyString(crit.value, listener.key.substr(crit.key.length+1));
				}
			}
			return result;
		}
		
		function _getCompleteKey(o) {
			var val = o.value, key = o.key, result = key;
			return key + _pullOutKeys(val);
		}
		
		function _pullOutKeys(v) {
			var p, res = '';
			for (p in v) {
				if (v.hasOwnProperty(p)) {
					res += '.' + p;
					if (typeof v[p] === 'object' && !(v[p] instanceof Array)) {
						res += _pullOutKeys(v[p]);
					}
				}
			}
			return res;
		}
		
		function _toRegex(s) {
			return s.replace(/\./g, '\\.').replace(/\*/g, '\.*');
		}
		
		function _valueMatchesKeyString(val, key) {
			var p, i=0, keys = key.split('.');
			for (p in val) {
				if (val.hasOwnProperty(p)) {
					if (keys[i] === '*' || p === keys[i]) {
						if ((typeof val[p] === 'object') && !(val[p] instanceof Array)) {
							return _valueMatchesKeyString(val[p], keys.slice(i+1).join('.'));						
						} else {
							return true;
						}
					}
				}
				i++;
			}
			return false;
		}
		
		// used to copy branches within the store. Object and array friendly
		function _clone(val) {
			var newObj, i, prop;
			if (val instanceof Array) {
				newObj = [];
				for (i=0; i<val.length; i++) {
					newObj[i] = _clone(val[i]);
				}
			} else if (typeof val === 'object'){
				newObj = {};
				for (prop in val) {
					if (val.hasOwnProperty(prop)) {
						newObj[prop] = _clone(val[prop]);
					}
				}
			} else {
				return val;
			}
			return newObj;
		}
		
		// returns a value from a store given an array of keys that is meant to describe depth
		// within the storage tree
		function _getValue(store, keys) {
			var key = keys.shift(), endKey, arrResult, p,
				keysClone;
			if (key === '*') {
				arrResult = [];
				
				for (p in store) {
					if (store.hasOwnProperty(p)) {
						keysClone = _clone(keys);
						arrResult.push(_getValue(store[p], keysClone));
					}
				}
				return arrResult;
			}
			if (keys[0] && store[key] && (store[key][keys[0]] || keys[0] === '*')) {
				return _getValue(store[key], keys);
			} else {
			    if (keys.length) {
			        endKey = keys[0];
			    } else {
			        endKey = key;
			    }
				return store[endKey];
			}
		}
		/************************************************************************
		/* End of JSDataStore class
		/************************************************************************/
		
		this._stores[id] = new JSDataStore(id);
		
		return this._stores[id];
	},
	
	/**
	 * Retrieves an existing data store object by id
	 *
	 * id {String}: the id of the store to retrieve
	 * returns {JSDataStore} the data store
	 */
	get: function(id) {
		return this._stores[id];
	},
	
	/**
	 * Removes all data stores objects. Specifically, each JSDataStore object's remove()
	 * method is called, and all local references to each are deleted.
	 */
	clear: function() {
		var storeId;
		for (storeId in this._stores) {
			if (this._stores.hasOwnProperty(storeId)) {
				this._stores[storeId].remove();
				delete this._stores[storeId];
			}
		}
		this._stores = {};
	},
	
	/**
	 * Returns a count of the existing data stores in memory
	 */
	count: function() {
		var cnt = 0, p;
		for (p in this._stores) {
			if (this._stores.hasOwnProperty(p)) {
				cnt++;
			}
		}
		return cnt;
	},
	
	/**
	 * Returns a list of ids [String] for all data store obects in memory
	 */
	ids: function() {
	    var id, ids = [];
	    for (id in this._stores) {
	        if (this._stores.hasOwnProperty(id)) {
	            ids.push(id);
	        }
	    }
	    return ids;
	},
	
	/**
	 * Used to add listeners to potentially any data store objects at once through
	 * a static interface. This listener will be executed whenever an event of the 
	 * specified type is emitted that also matches the conditions in the options
	 * parameter.
	 *
	 * type {String}: the type of event to listen to
	 * options {object}: an object that contains one or more of the following configurations:
	 *                  'callback': the function to be executed
	 *                  'scope': the scope object for the callback execution
	 *                  'key': the storage key to listen for. If specified only stores into this key will
	 *                          cause callback to be executed
	 *                  'keys': list of keys that will cause callback to be executed (overrides 'key' option)
	 */
	on: function(type, o) {
	    if (!this._listeners[type]) {
			this._listeners[type] = [];
		}
		this._listeners[type].push(o);
	}
};
(function() {
    var ajax = jQuery.ajax;
    
    jQuery.ajax = function(settings) {
        var store, 
			success = settings.success,
			error = settings.error;
			
		function drill(chunk, target) {
			var pieces;
			if (target.indexOf('.') > 0) {
				pieces = target.split('.');
				return drill(chunk[pieces[0]], pieces.slice(1,pieces.length).join('.'));
			}
			return chunk[target];
		}
		
        if (settings.jsds && settings.jsds.id) {
            settings.success = function(data, status, req) {
				store = JSDS.get(settings.jsds.id);
                if (!store) {
                    store = JSDS.create(settings.jsds.id);
                }
				if (settings.jsds.target) {
					data = drill(data, settings.jsds.target);
				}
                store.store(settings.jsds.key || 'defaultKey', data, {update: true});
				if (success) {
					success(data, status, req);
				}
            };
            settings.error = function(req, status, err) {
                if (error) {
					error(req, status, err);
				}
            };
            settings.dataType = 'json';
        }
        ajax(settings);
    };
    
    jQuery.jsds = {
        on: function (target, opts) {
            JSDS.on(target, opts);
        },
		// ugly testing backdoors
		__stealAjax: function() {
			return ajax;
		},
		__replaceAjax: function(ajx) {
			ajax = ajx;
		}
    };
    
})();