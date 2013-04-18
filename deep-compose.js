/**
 *
 * When you collide two functions together, you could use deep.compose to manage how collision is resolved.
 * Keep in mind that if you collide a simple function (up) on a composition (chained or not) : it mean : simply overwrite the composition by the function.
 * So if you apply a composition from bottom on a function, the composition will never b applied.
 * If you collide two compositions : they will be merged to give a unique composition chain.
 * 
 * @example
 * deep.compose : Chained Aspect Oriented Programming
==========================
SEE DOCS/deep.md for full doc



## deep.compose.before( func )

If it returns something, it will be injected as argument(s) in next function.
If it return nothing, th original arguments are injected in next function.
If it returns a promise or a chain : it will wait until the resolution of the returned value.
If the returned object isn't a promise, the next function is executed immediately.

ex : 

	var base = {
	    myFunc:deep.compose.after(function(arg)
	    {
	        return arg + " _ myfunc base";
	    })
	}

	deep(base)
	.bottom({
	    myFunc:function(arg){
	        return arg + " _ myfunc from bottom";
	    }
	});

	base.myFunc("hello");


## deep.compose.after( func )

If the previous returns something, it will be injected as argument(s) in 'func'.
If the previous return nothing, th original arguments are injected in 'func'.
If the previous returns a promise or a chain : it will wait until the resolution of the returned value before executing 'func'.
If the previous returned object isn't a promise, 'func' is executed immediately.

Same thing for returned object(s) from 'func' : it will be chained..

	ex : 

	var base = {
	    myFunc:function(arg)
	    {
	        return arg + " _ myfunc base";
	    }
	}

	deep(base)
	.up({
	    myFunc:deep.compose.after(function(arg){
	        return arg + " _ myfunc from after";
	    })
	});

	base.myFunc("hello");

## deep.compose.around( func )

here you want to do your own wrapper.
Juste provid a function that receive in argument the collided function (the one which is bottom),
an which return the function that use this collided function.

	ex : 

	var base = {
		myFunc:function(arg)
		{
			return arg + " _ myfunc base";
		}
	}

	deep(base)
	.up({
	    myFunc:deep.compose.around(function(collidedMyFunc){
	    	return function(arg){
	    		return collidedMyFunc.apply(this, [arg + " _ myfunc from around"]);
	    	}
	    })
	});

	base.myFunc("hello");


## deep.compose.parallele( func )

when you want to call a function in the same time of an other, and to wait that both function are resolved (even if deferred)
before firing eventual next composed function, you could use deep.compose.parallele( func )

Keep in mind that the output of both functions will be injected as a single array argument in next composed function.
Both will receive in argument either the output of previous function (if any, an even if deferred), or the original(s) argument(s).

So as implies a foot print on the chaining (the forwarded arguments become an array) : 
It has to be used preferently with method(s) that do not need to handle argument(s), and that return a promise just for maintaining the chain asynch management.

An other point need to be clarify if you use deep(this).myChain()... in the composed function.
As you declare a new branch on this, you need to be careful if any other of the composed function (currently parallelised) do the same thing.

You'll maybe work on the same (sub)objects in the same time.

## compositions chaining 

You could do 
	var obj = {
		func:deep.compose.after(...).before(...).around(...)...
	}
It will wrap, in the order of writing, and immediately, the compositions themselves.
You got finally an unique function that is itself a composition (and so could be applied later an other functions).

So when you do : 

deep.parallele(...).before(...) and deep.before(...).parallel(...)

it does not give the same result of execution.

In first : you wrap the collided function with a parallele, and then you chain with a before.
So finally the execution will be : the before and then the parallelised call.

In second : you wrap the collided function with a before, and then wrap the whole in a parallele.
So the execution will be the parallelised call, but on one branche, there is two chained calls (the before and the collided function). 

Keep in mind that you WRAP FUNCTIONS, in the order of writing, and IMMEDIATELY.
 *
 * 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * @module deep
 * @submodule deep-compose
 * @example
 *
 *
 * 	var a = {
 *   	myFunc:function(){
 *   		// do something
 *  	 }
 * 	}
 *
 * 	var b = {
 * 		myFunc:deep.compose.after(function(){
 * 	   		// do something
 * 		})
 * 	}
 *
 *
 * 	deep.utils.up(b,a).myFunc()
 * 
 */
if(typeof define !== 'function')
	var define = require('amdefine')(module);

define(function(require, exports, module){
	var promise = require("./promise");
	// console.log("Deep-compose init");

	/**
	 * @class DeepDecorator
	 * @constructor
	 * @param {Array} stack stack of functions to chain
	 */
	var DeepDecorator = function (stack) {
		this.stack = stack || [];
	};

	function chain(before, after)
	{
		return function () {
			var self = this;
			var args = arguments;
			var def = promise.Deferred();
			var r = before.apply(this, args);
			//console.log("chain.first : result == ", r)

			if(typeof r === 'undefined')
			{
				//console.log("chain.first : result == undefined")
				r = after.apply(self,args);
				//console.log("chain.second : result : ", r)
				if(typeof r === 'undefined')
					return r;
				if(!r.then)
					return r;
				promise.when(r)
				.then(function (suc) {
					def.resolve(suc);
				}, function (error) {
					def.reject(error);
				});
			}
			else if(!r.then)
			{
				r = after.apply(self,[r]);
				if(typeof r === 'undefined')
					return r;
				if(!r.then)
					return r;
				promise.when(r).then(function (suc) {
					//	console.log("chain.second.promise.when : result : ", suc)
					def.resolve(suc);
				}, function (error) {
					def.reject(error);
				});
			}
			else
			{
				//console.log("________________BEFORE promise.when___________");
				promise.when(r).then(function (r)
				{
					//console.log("after : promise.when(first) res : ", r);
					var argus = args ;
					if(typeof r !== 'undefined' )
						argus = [r];
					r = after.apply(self,argus);
					if(typeof r === 'undefined' )
						return	def.resolve(r);
					if(!r.then)
						return def.resolve(r);
					promise.when(r).then(function (suc) {
						def.resolve(suc);
					}, function (error) {
						def.reject(error);
					});
				}, function (error) {
					def.reject(error);
				});
			}
			return promise.promise(def);
		};
	}
	DeepDecorator.prototype = {
		/**
		 * 	If it returns something, it will be injected as argument(s) in next function.
			If it return nothing, th original arguments are injected in next function.
			If it returns a promise or a chain : it will wait until the resolution of the returned value.
			If the returned object isn't a promise, the next function is executed immediately.

			@example

				var base = {
				    myFunc:deep.compose.after(function(arg)
				    {
				        return arg + " _ myfunc base";
				    })
				}

				deep(base)
				.bottom({
				    myFunc:function(arg){
				        return arg + " _ myfunc from bottom";
				    }
				});

				base.myFunc("hello"); // will log 'bottom' then 'base'

			@method before
		 * @chainable
		 * @param  {Function} argument the function to execute BEFORE the collided one
		 * @return {[type]}
		 */
		before : function (argument)
		{
			var wrapper = function (previous)
			{
				return chain(argument, previous);
			};
			this.stack.push(wrapper);
			return this;
		},
		/**
		 *
		 * chainable around composition
		 *
		 * 
		 * here you want to do your own wrapper.
		 * Juste provid a function that receive in argument the collided function (the one which is bottom),
		 * an which return the function that use this collided function.
		 *
		 * @example
		 * 		var base = {
					myFunc:function(arg)
					{
							return arg + " _ myfunc base";
					}
				}

				deep(base)
				.up({
				    myFunc:deep.compose.around(function(collidedMyFunc){
				    	return function(arg){
				    		return collidedMyFunc.apply(this, [arg + " _ myfunc from around"]);
				    	}
				    })
				});

				base.myFunc("hello");
		 *
		 * @method around
		 * @chainable
		 * @param  {Function} wrapper a fonction to wrap the collided one
		 * @return {DeepDecorator} this
		 */
		around : function (wrapper)
		{
			var func = function (previous)
			{
				return wrapper(previous);
			};
			this.stack.push(func);
			return this;
		},
		/**
		If the previous returns something, it will be injected as argument(s) in 'func'.
		If the previous return nothing, th original arguments are injected in 'func'.
		If the previous returns a promise or a chain : it will wait until the resolution of the returned value before executing 'func'.
		If the previous returned object isn't a promise, 'func' is executed immediately.

		Same thing for returned object(s) from 'func' : it will be chained..

		@example

			var base = {
			    myFunc:function(arg)
			    {
			        return arg + " _ myfunc base";
			    }
			}

			deep(base)
			.up({
			    myFunc:deep.compose.after(function(arg){
			        return arg + " _ myfunc from after";
			    })
			});

			base.myFunc("hello"); // will log 'base' before 'after'

		@method after
		@chainable
		@param {Function} argument the function to execute AFTER the collided one
		@return {DeepDecorator} this
		*/
		after : function (argument)
		{
			var wrapper = function (previous)
			{
				return chain(previous, argument);
			};
			this.stack.push(wrapper);
			return this;
		},
		/**
		 * wrap collided function with fn and execute fn only if collided function return an error.
		 * @method fail
		 * @chainable
		 * @param  {Function} fn
		 * @return {DeepDecorator} this
		 */
		fail : function (fn)
		{
			var wrapper = function (previous)
			{
				return function()
				{
					var self = this;
					var args = arguments;
					return promise.when(previous.apply(this, args))
					.done(function (res) {
						//console.log("compose.fail : previous done : ", res);
						if(res instanceof Error)
							return fn.apply(self, [res]);
						return res;
					})
					.fail(function (error) {
						//console.log("compose.fail : previous error : ", error);
						return fn.apply(self, [error]);
					});
				};
			};
			this.stack.push(wrapper);
			return this;
		},
		/**
		 * replace collided function by this one
		 * @method replace
		 * @chainable
		 * @param  {Function} argument
		 * @return {DeepDecorator} this
		 */
		replace : function (argument)
		{
			var wrapper = function (previous)
			{
				return argument;
			};
			this.stack.push(wrapper);
			return this;
		},
		/**
		 * execute collided function PARALLELY with provided function
		 *
		 * when you want to call a function in the same time of an other, and to wait that both function are resolved (even if deferred)
		 * before firing eventual next composed function, you could use deep.compose.parallele( func )
		 * 
		 * Keep in mind that the output of both functions will be injected as a single array argument in next composed function.
		 * Both will receive in argument either the output of previous function (if any, an even if deferred), or the original(s) argument(s).

		 * So as it implies that the forwarded arguments become an array : 
		 * It has to be used preferently with method(s) that do not need to handle argument(s), and that return a promise just for maintaining the chain asynch management.
		 *
		 * @example
		 *
		 * 		var a = {
		 * 			load:function(){
		 * 				return deep("json::myfile.json")
		 * 				.done(function (success) {
		 * 					// do something
		 * 				});
		 * 			}
		 * 		}
		 *
		 * 		deep({
		 * 			load:deep.compose.parallele(function(){
		 * 				return deep("json::myotherfile.json")
		 * 				.done(function (success) {
		 * 					// do something
		 * 				});
		 * 			})
		 * 		})
		 * 		.bottom(a)
		 * 		.load()
		 * 		.log(); // will perform both loads (http get on json files) parallely (in the same time)
		 * 
		 * @method parallele
		 * @chainable
		 * @param  {[type]} argument
		 * @return {[type]}
		 */
		parallele : function (argument)
		{
			var wrapper = function (previous)
			{
				return function ()
				{
					var args = arguments;
					var promises = [argument.apply(this, args), previous.apply(this,args)];
					return promise.all(promises);
				};
			};
			this.stack.push(wrapper);
			return this;
		}
	};
	var createStart = function (decorator)
	{
		decorator = decorator || new DeepDecorator();
		var start = function () {
			if(!decorator.createIfNecessary)
				throw new Error("Decorator not applied ! (start)");
			return compose.wrap(function(){}, decorator).apply(this, arguments);
		};
		start.decorator = decorator;
		start.after = function (argument) {
			decorator.after(argument);
			return start;
		};
		start.before = function (argument) {
			decorator.before(argument);
			return start;
		};
		start.fail = function (argument) {
			decorator.fail(argument);
			return start;
		};
		start.around = function (argument) {
			decorator.around(argument);
			return start;
		};
		start.parallele = function (argument) {
			decorator.parallele(argument);
			return start;
		};
		start.replace = function (argument) {
			decorator.replace(argument);
			return start;
		};
		start.createIfNecessary = function (arg) {
			start.decorator.createIfNecessary = (typeof arg === 'undefined')?true:arg;
			return start;
		};
		start.ifExists = function (arg) {
			start.decorator.ifExists = (typeof arg === 'undefined')?true:arg;
			return start;
		};
		start.condition = function (arg) {
			start.condition = arg;
			return start;
		};
		return start;
	};

	var compose = {
		Decorator:DeepDecorator,
		cloneStart:function (start) {
			var newStack = start.decorator.stack.concat([]);
			var nd = new DeepDecorator(newStack);
			nd.ifExists = start.decorator.ifExists;
			nd.createIfNecessary = start.decorator.createIfNecessary;
			return createStart(nd);
		},
		wrap:function (func, decorator)
		{
			var fin = func;
			decorator.stack.forEach(function (wrapper)
			{
				fin = wrapper(fin);
			});
			return fin;
		},
		createIfNecessary : function ()
		{
			var start = createStart();
			start.decorator.createIfNecessary = true;
			return start;
		},
		ifExists : function ()
		{
			var start = createStart();
			start.decorator.ifExists = true;
			return start;
		},
		condition:function (argument) {
			var start = createStart();
			start.decorator.condition = argument;
			return start;
		},
		up : function (bottom, up)
		{
			if(typeof up !== 'function' || typeof bottom !== 'function')
				throw new Error("DeepDecorator.collide : you could only apply function together");
			if(!up.decorator || !(up.decorator instanceof DeepDecorator))
				return up;
			if(bottom.decorator && bottom.decorator instanceof DeepDecorator)
			{
				bottom.decorator.stack = bottom.decorator.stack.concat(up.decorator.stack);
				return bottom;
			}
			return compose.wrap(bottom,up.decorator);
		},
		bottom : function (bottom, up)
		{
			if(typeof up !== 'function' || typeof bottom !== 'function')
				throw new Error("DeepDecorator.collide : you could only apply function together");
			if(!up.decorator || !(up.decorator instanceof DeepDecorator))
				return up;
			if(bottom.decorator && bottom.decorator instanceof DeepDecorator)
			{
				up.decorator.stack = bottom.decorator.stack.concat(up.decorator.stack);
				return up;
			}
			return compose.wrap(bottom,up.decorator);
		},
		around : function (argument)
		{
			return createStart().around(argument);
		},
		after : function (argument)
		{
			return createStart().after(argument);
		},
		before : function (argument)
		{
			return createStart().before(argument);
		},
		fail : function (argument)
		{
			return createStart().fail(argument);
		},
		parallele : function (argument)
		{
			return createStart().parallele(argument);
		},
		replace : function (argument)
		{
			return createStart().replace(argument);
		}
	};
	// console.log("Deep-compose initialised");

	return compose;
});