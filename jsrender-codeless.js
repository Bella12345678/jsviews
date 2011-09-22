/*! JsRender v1.0pre - (jquery.render.js version: requires jQuery): http://github.com/BorisMoore/jsrender */
/*
 * Optimized version of jQuery Templates, for rendering to string - 'codeless' version
 */
window.JsViews || window.jQuery && jQuery.jsViews || (function( window, undefined ) {

var $, tmplTags, tmplEncode,
	FALSE = false, TRUE = true,
	jQuery = window.jQuery, document = window.document;
	htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
	stack = [],
	autoName = 0,
	escapeMapForHtml = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	},
	htmlSpecialChar = /[\x00"&'<>]/g,
	slice = Array.prototype.slice;

if ( jQuery ) {

	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is loaded, so make $ the jQuery object
	$ = jQuery;

	$.fn.extend({
		// Use first wrapped element as template markup.
		// Return string obtained by rendering the template against data.
		render: function( data, context, parentView, path ) {
			return $.render( this[0], data, context, parentView, path );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		template: function( name, context ) {
			return $.template( name, this[0], context );
		}
	});

} else {

	////////////////////////////////////////////////////////////////////////////////////////////////
	// jQuery is not loaded. Make $ the JsViews object
	window.JsViews = window.$ = $ = {
		extend: function( target, source ) {
			if ( source === undefined ) {
				source = target;
				target = $;
			}
			for ( var name in source ) {
				target[ name ] = source[ name ];
			}
			return target;
		},
		map: function( elems, callback ) {
			var value, ret = [],
				i = 0,
				length = elems.length;

			if ( $.isArray( elems )) {
				for ( ; i < length; i++ ) {
					value = callback( elems[ i ], i );

					if ( value != null ) {
						ret.push( value );
					}
				}
			}
			// Flatten any nested arrays
			return ret.concat.apply( [], ret );
		},
		each: function( object, callback ) {
			var name,
				i = 0,
				length = object.length;

			if ( length === undefined || $.isFunction( object )) {
				for ( name in object ) {
					callback.call( object[ name ], name, object[ name ] );
				}
			} else for ( ; i < length; ) {
				callback.call( object[ i ], i, object[ i++ ] );
			}
			return object;
		},
		isFunction: function( obj ) {
			return typeof obj === "function";
		},
		isArray: Array.isArray || function( obj ) {
			return Object.prototype.toString.call( obj ) === "[object Array]";
		}
	}
}

//=================
// View constructor
//=================

function View( context, path, parentView, data, template ) {
	// Returns a view data structure for a new rendered instance of a template.
	// The content field is a hierarchical array of strings and nested views.

	var self, content,
		parentContext = parentView && parentView.ctx;

	parentView = parentView || { viewsCount:0 };

	self = {
		path: path || "",
		// inherit context from parentView, merged with new context.
		itemNumber: ++parentView.viewsCount || 1,
		viewsCount: 0,
		tmpl: template,
		data: data || parentView.data || {},
		// Set additional context on this view (which will modify the context inherited from the parent, and be inherited by child views)
		ctx : context && context === parentContext
			? parentContext
			: (parentContext ? $.extend( {}, parentContext, context ) : context),
		parent: parentView
	};
	return self;
}

//===============
// renderTag
//===============

function getValue( view, path ) { // TODO optimize in case whether this a simple path on an object - no bindings etc.
	if ( "" + path !== path ) {
		return path;
	}
	var object, varName;
	path = path.split(".");
	object = path[ 0 ].charAt( 0 ) === "$"
		? (varName = path.shift().slice( 1 ), varName === "view" ? view : view[ varName ])
		: view.data;

	// If 'from' path points to a property of a descendant 'leaf object',
	// link not only from leaf object, but also from intermediate objects
	while ( object && path.length > 1 ) {
		object = object[ path.shift() ];
	}
	path = path[ 0 ];
	return path ? object && object[ path ] : object;
}

$.extend({
	tmpl: {
		templates: {},

		allowCode: FALSE,

//===============
// renderTag
//===============

		renderTag: function( tagName ) {
			// This is a tag call, with arguments: "tagName", [params, ...], [content,] [params.toString,] view, encoding, [hash,] [nestedTemplateFnIndex]
			var content, ret, path, view, encoding, hash, l,
				args = slice.call( arguments, 1 ),
				tagFn = tmplTags[ tagName ];

			if ( !tagFn ) {
				// If not a tagFn, return empty string, and throw if in debug mode
				return "";
			}

			encoding = args.pop();
			if ( +encoding === encoding ) {
				// Last arg is a number, so this is a block tagFn and last arg is the nested template index (integer key)
				// assign the sub-content template function as last arg
				content = encoding;
				encoding = args.pop(); // In this case, encoding is the next to last arg
			}
			if ( "" + encoding !== encoding ) {
				// Last arg is a number, so this is a block tagFn and last arg is the nested template index (integer key)
				// assign the sub-content template function as last arg
				hash = encoding;
				encoding = args.pop(); // In this case, encoding is the next to last arg
			}
			view = args.pop();
			content = content !== undefined && view.tmpl.nested[ content ];
			l = args.length;
			if ( l ) {
				ret = [ content, args.toString(), encoding ];
				if ( hash ) {
					ret.unshift( hash );
				}
				ret = tagFn.apply( view, $.map( args, function( val ) {
					return /^(['"]).*\1$/.test( val )
						// If parameter is quoted text ('text' or "text") - replace by string: text
						? val.slice( 1,-1 )
						// Otherwise, treat as path to be evaluated
						: [getValue( view, val )];
				}).concat( ret ));
			} else {
				ret = tagFn.call( view, content, encoding );
			}

			return encoding === "string" ? ('"' + ret + '"') : ret;
			// Useful to force chained tags to return results as string values,
			// (wrapped as quoted string) for passing as arguments to calling tag
		},

//===============
// registerTags
//===============

		// Register declarative tag.
		registerTags: function registerTags( name, fn ) {
			if ( typeof( name ) === "object" ) {
				// Object representation where property name is path and property value is value.
				// TODO: We've discussed an "objectchange" event to capture all N property updates here. See TODO note above about propertyChanges.
				for ( var key in name ) {
					registerTags( key, name[ key ])
				}
			} else {
				// Simple single property case.
				tmplTags[ name ] = fn;
			}
			return this;
		},

//===============
// Built-in tags
//===============

		tmplTags: tmplTags = {
			"if": function() {
				function ifArgs( args ) {
					var i = 0,
						l = args.length - 3; // number of parameters, since args are: (parameters..., content, params.toString, encoding)
					while ( l > -1 && !args[ i++ ]) {
						// Only render content if args.length < 3 (i.e. this is an else with no condition) or if a condition argument is truey
						if ( i === l ) {
							return "";
						}
					}
					self.onElse = undefined;
					return $.render( args[ l < 0 ? 0 : l ], self.data, self.context, self);//, l > 0 && args[ l + 1 ] );
				}
				var self = this;
				self.onElse = function() {
					return ifArgs( arguments );
				};
				return ifArgs( arguments );
			},
			"else": function() {
				return this.onElse ? this.onElse.apply( this, arguments ) : "";
			},
			each: function() {
				var result = "",
					args = arguments,
					i = 0,
					l = args.length - 1,
					content = args[ l - 2 ],
					path = args[ l - 1 ];
					if ( !content ) {
						l--;
						content = args[ l - 2 ];
					}
				for ( ; i < l - 2; i++ ) {
					result += args[ i ] ? $.render( content, args[ i ], this.context, this, path ) : "";
				}
				return result;
			},
			"*": function( value ) {
				return value;
			}
		},

//===============
// tmpl.encode
//===============

		encode: tmplEncode = {
			"none": function( text ) {
				return text;
			},
			"html": function( text ) {
				// HTML encoding helper: Replace < > & and ' and " by corresponding entities.
				// Implementation, from Mike Samuel <msamuel@google.com>
				return String( text ).replace( htmlSpecialChar, replacerForHtml );
			},
			"string": function( text ) {
				return '"' + text + '"'; // Used for chained helpers to return quoted strings
			}
			//TODO add URL encoding, and perhaps other encoding helpers...
		}
	},

//===============
// render
//===============

	render: function( tmpl, data, context, parentView, path ) {
		// Render template against data as a tree of subviews (nested template), or as a string (top-level template).
		var i, l, dataItem, arrayView, content, result = "";

		tmpl = $.template( tmpl );
		if ( !tmpl ) {
			return null; // Could throw...
		}
//		if (  $.isFunction( data )) {
//			data = data.call( parentView || {} );
//		}

		if ( $.isArray( data )) {
			// Create a view item for the array, whose child views correspond to each data item.
			arrayView = View( context, path, parentView, data);
			l = data.length;
			for ( i = 0, l = data.length; i < l; i++ ) {
				dataItem = data[ i ];
				content = dataItem ? tmpl( dataItem, View( context, path, arrayView, dataItem, tmpl )) : "";
				result += $.view ? "<!--item-->" + content + "<!--/item-->" : content;
			}
		} else {
			result += tmpl( data, View( context, path, parentView, data, tmpl ))
		}

		return $.view
			// If $.view is defined, include annotations
			? "<!--tmpl(" + (path || "") + ") " + tmpl._name + "-->" + result + "<!--/tmpl-->"
			// else return just the string array
			: result;
	},

//===============
// template
//===============

	// Set:
	// Use $.template( name, tmpl ) to cache a named template,
	// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
	// Use $( "selector" ).template( name ) to provide access by name to a script block template declaration.

	// Get:
	// Use $.template( name ) to access a cached template.
	// Also $( selectorToScriptBlock ).template(), or $.template( null, templateString )
	// will return the compiled template, without adding a name reference.
	// If templateString is not a selector, $.template( templateString ) is equivalent
	// to $.template( null, templateString ). To ensure a string is treated as a template,
	// include an HTML element, an HTML comment, or a template comment tag.
	template: function( name, tmpl ) {
		if (tmpl) {
			// Compile template and associate with name
			if ( "" + tmpl === tmpl ) {
				// This is an HTML string being passed directly in.
				tmpl = compile( tmpl );
			} else if ( jQuery && tmpl instanceof $ ) {
				tmpl = tmpl[0];
			}
			if ( tmpl ) {
				if ( jQuery && tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = $.data( tmpl, "tmpl" ) || $.data( tmpl, "tmpl", compile( tmpl.innerHTML ));
				}
				$.tmpl.templates[ tmpl._name = tmpl._name || name || "_" + autoName++ ] = tmpl;
			}
			return tmpl;
		}
		// Return named compiled template
		return name
			? "" + name !== name
				? (name._name
					? name // already compiled
					: $.template( null, name ))
				: $.tmpl.templates[ name ] ||
					// If not in map, treat as a selector. (If integrated with core, use quickExpr.exec)
					$.template( null, htmlExpr.test( name ) ? name : try$( name ))
			: null;
	}
});

//=================
// compile template
//=================

// Generate a reusable function that will serve to render a template against data
// (Compile AST then build template function)
function compile( markup ) {
	var loc = 0,
		inBlock = TRUE,
		stack = [],
		top = [],
		content = top,
		current = [,,top];

	function pushPreceedingContent( shift ) {
		shift -= loc;
		if ( shift ) {
			var text = markup.substr( loc, shift ).replace(/\n/g,"\\n");
			if ( inBlock ) {
				content.push( text );
			} else {
				if ( !text.split('"').length%2 ) {
					// This is a {{ or }} within a string parameter, so skip parsing. (Leave in string)
					return TRUE;
				}
										//( path	or 	\"string\" )	   or (   path        =    ( path    or  \"string\" )
				(text + " ").replace( /([\w\$\.\[\]]+|(\\?['"])(.*?)\2)(?=\s)|([\w\$\.\[\]]+)\=([\w\$\.\[\]]+|\\(['"]).*?\\\6)(?=\s)/g,
					function( all, path, quot, string, lhs, rhs, quot2 ) {
						content.push( path ? path : [ lhs, rhs ] ); // lhs and rhs are for named params
					}
				);
			}
		}
	}

	// Build abstract syntax tree: [ tag, params, content, encoding ]
	markup = markup
		.replace( /\\'|'/g, "\\\'" ).replace( /\\"|"/g, "\\\"" )  //escape ', and "
		.split( /\s+/g ).join( " " ) // collapse white-space
		.replace( /^\s+/, "" ) // trim left
		.replace( /\s+$/, "" ); // trim right;

	//					 {{		 #		tag							singleCharTag							code						 !encoding }}		{{/closeBlock}}
	markup.replace( /(?:\{\{(?:(\#)?([\w\$\.\[\]]+(?=[\s\}!]))|([^\/\*\w\s\d\x7f\x00-\x1f](?=[\s\w\$\[]))|\*((?:[^\}]|\}(?!\}))+)\}\}))|(!(\w*))?(\}\})|(?:\{\{\/([\w\$\.\[\]]+)\}\})/g,
		function( all, isBlock, tagName, singleCharTag, code, useEncode, encoding, endTag, closeBlock, index ) {
			tagName = tagName || singleCharTag;
			if ( pushPreceedingContent( index )) {
				return;
			}
			if ( code ) {
				if ( $.tmpl.allowCode ) {
					content.push([ "*", code.replace( /\\(['"])/g, "$1" )]);   // unescape ', and "
				}
			} else if ( tagName ) {
				if ( tagName === "else" ) {
					current = stack.pop();
					content = current[ 2 ];
					isBlock = TRUE;
				}
				stack.push( current );
				content.push( current = [ tagName, [], isBlock && 1] );
			} else if ( endTag ) {
				current[ 3 ] = useEncode ? encoding || "none" : "";
				if ( current[ 2 ] ) {
					current[ 2 ] = [];
				} else {
					current = stack.pop();
				}
			} else if ( closeBlock ) {
				current = stack.pop();
			}
			loc = index + all.length; // location marker - parsed up to here
			inBlock = !tagName && current[ 2 ] && current[ 2 ] !== 1;
			content = current[ inBlock ? 2 : 1 ];
		});

	pushPreceedingContent( markup.length );

	return buildTmplFunction( top );
}

// Build javascript compiled template function, from AST
function buildTmplFunction( nodes ) {
	var ret, content, node,
		endsInPlus = TRUE,
		chainingDepth = 0,
		nested = [],
		i = 0,
		l = nodes.length,
		code = 'var tag=$.tmpl.renderTag,html=$.tmpl.encode.html,\nresult=""+';

	function nestedCall( node, parentCtx ) {
		if ( "" + node === node ) {
			return '"' + node + '"';
		}
		if ( node.length < 3 ) {
			// Named parameter
			parentCtx[ 0 ] += (parentCtx[ 0 ] && ",") + node[ 0 ] + ":" + nestedCall( node[ 1 ]);
			return FALSE;
		}
		var codeFrag, tokens, j, k, ctx, val,
			hash = "",
			tag = node[ 0 ],
			params = node[ 1 ],
			encoding = node[ 3 ];
		if ( tag === "=" ) {
			// TODO test for chainingDepth: using {{= }} at depth>0 is an error.
			if ( chainingDepth > 0 || params.length !== 1 ) {
				return ""; // Could throw...
			}
			params = params[ 0 ];
			if ( tokens = /^((?:\$view|\$data|\$(itemNumber)|\$(ctx))(?:$|\.))?[\w\.]*$/.exec( params )) {
				// Can optimize for perf and not go through call to renderTag()
				codeFrag = tokens[ 1 ]
					? tokens[ 2 ] || tokens[ 3 ]
						? ('$view.' + params.slice( 1 )) // $itemNumber, $ctx -> $view.itemNumber, $view.ctx
						: params // $view, $data - unchanged
					: '$data.' + params; // other paths -> $data.path
				if ( encoding !== "none" ) {
					codeFrag = 'html(' + codeFrag + ')';
				}
			} else {
				// Cannot optimize here. Must call renderTag() for processing, encoding etc.
				codeFrag = 'tag("=","' + params + '",$view,"' + encoding + '")'; // Not able
			}
		} else {
			codeFrag = 'tag("' + tag + '",';
			chainingDepth++;
			ctx = [ hash ]; // out param
			for ( j = 0, k = params.length; j < k; j++ ) {
				val = nestedCall( params[ j ], ctx );
				codeFrag += val ? (val + ',') : "";
			}
			hash = ctx[ 0 ];
			chainingDepth--;
			content = node[ 2 ];
			codeFrag += '$view,"'
				+ encoding + '"'
				+ (hash ? ",{" + hash + "}" : "")
				+ (content ? "," + nested.length : ""); // For block tags, pass in the key to the nested content template
			if( content ) {
				nested.push( buildTmplFunction( content ));
			}
			codeFrag += ')';
		}
		return codeFrag;
	}

	for ( ; i < l; i++ ) {
		endsInPlus = TRUE;
		node = nodes[ i ];
		if ( node[ 0 ] === "*" ) {
			code = code.slice( 0, -1 ) + ";" + node[ 1 ] + "result+=";
		} else {
			code += nestedCall( node ) + "+";
			endsInPlus = TRUE;
		}
	}
	ret = new Function( "$data, $view", code.slice( 0, endsInPlus ? -1 : -8 ) + ";\nreturn result;" );
	ret.nested = nested;
	return ret;
}

//========================== Private helper functions, used by code above ==========================

function encode( encoding, text ) {
	return text
		? encoding
			? ( tmplEncode[ encoding ] || tmplEncode.html)( text ) // HTML encoding is the default
			: '"' + text + '"'
		: "";
}

function replacerForHtml( ch ) {
	// Original code from Mike Samuel <msamuel@google.com>
	return escapeMapForHtml[ ch ]
		// Intentional assignment that caches the result of encoding ch.
		|| ( escapeMapForHtml[ ch ] = "&#" + ch.charCodeAt( 0 ) + ";" );
}

function try$( selector ) {
	// If selector is valid, return jQuery object, otherwise return (invalid) selector string
	try {
		return $( selector );
	} catch( e) {}
	return selector;
}

})( window );
