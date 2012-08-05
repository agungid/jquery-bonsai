(function($){
	$.fn.bonsai = function( options ) {
		return this.each(function() {
			var bonsai = new Bonsai(this, options);
			$(this).data('bonsai', bonsai);
		});
	};
	var Bonsai = function( el, options ) {
		var self = this,
			// fill options with default values
			options = $.extend({
				expandAll: false, // boolean expands all items
				expand: null, // function to expand an item
				collapse: null, // function to collapse an item
				checkboxes: false, // requires jquery.qubit
				// createCheckboxes: creates checkboxes for each list item.
				// 
				// The name and value for the checkboxes can be declared in the
				// markup using `data-name` and `data-value`.
				// 
				// The name is inherited from parent items if not specified.
				// 
				// Checked state can be indicated using `data-checked`.
				createCheckboxes: false,
				// handleDuplicateCheckboxes: adds onChange bindings to update 
				// any other checkboxes that have the same value.
				handleDuplicateCheckboxes: false
			}, options),
			checkboxes, isRootNode;
		this.el = el = $(el);
		// store the scope in the options for child nodes
		if( !options.scope ) {
			options.scope = el;
			isRootNode = true;
		}
		this.options = options;
		el.addClass('bonsai');
		
		if( options.checkboxes ) {
			checkboxes = true;
			// handle checkboxes once at the root of the tree, not on each element
			options.checkboxes = false;
		}
		// look for a nested list (if any)
		el.children().each(function() {
			var item = $(this),
				// insert a thumb
				thumb = $('<div class="thumb" />');
			if( options.createCheckboxes ) {
				// insert a checkbox after the thumb
				self.insertCheckbox(item);
			}
			item.prepend(thumb);
			// if there is a child list
			$(this).children().filter('ol, ul').last().each(function() {
				// that is not empty
				if( $('li', this).length == 0 ) {
					return;
				}
				// then this el has children
				item.addClass('has-children')
					// attach the sub-list to the item
					.data('subList', this);
				thumb.on('click', function() {
					self.toggle(item);
				});
				// collapse the nested list
				if( options.expandAll || item.hasClass('expanded') ) {
					self.expand(item);
				}
				else {
					self.collapse(item);
				}
				// handle any deeper nested lists
				$(this).bonsai(options)
			});
		});
		// if this is root node of the tree
		if( isRootNode ) {
			if( checkboxes )
				el.qubit(options);
			if( this.options.addExpandAll )
				this.addExpandAll();
			if( this.options.addSelectAll )
				this.addSelectAll();
		} 
		this.expand = options.expand || this.expand;
		this.collapse = options.collapse || this.collapse;
		this.el.data('bonsai', this);
		this.initialised = true;
	};
	Bonsai.prototype = {
		initialised: false,
		toggle: function( listItem ) {
			if( !$(listItem).hasClass('expanded') ) {
				this.expand(listItem);
			}
			else {
				this.collapse(listItem);
			}
		},
		expand: function( listItem ) {
			this.setExpanded(listItem, true);
		},
		collapse: function( listItem ) {
			this.setExpanded(listItem, false);
		},
		setExpanded: function( listItem, expanded ) {
			listItem = $(listItem);
			if( listItem.length > 1 ) {
				var self = this;
				listItem.each(function() {
					self.setExpanded(this, expanded);
				});
				return;
			}
			if( expanded ) {
				if( !listItem.data('subList') )
					return;
				listItem = $(listItem).addClass('expanded')
					.removeClass('collapsed');
				$(listItem.data('subList')).css('height', 'auto');
			}
			else {
				listItem = $(listItem).addClass('collapsed')
					.removeClass('expanded');
				$(listItem.data('subList')).height(0);
			}
		},
		expandAll: function() {
			this.expand($('li', this.el));
		},
		collapseAll: function() {
			this.collapse($('li', this.el));
		},
		insertCheckbox: function( listItem ) {
			var id = this.generateId(listItem),
				checkbox = $('<input type="checkbox" name="' 
					+ this.getCheckboxName(listItem)
					+ '" id="' + id  + '" /> '
				),
				children = listItem.children(),
				// get the first text node for the label
				text = listItem.contents().filter(function() {
						return this.nodeType == 3;
					}).first(),
				self = this;
			checkbox.val(listItem.data('value'));
			checkbox.prop('checked', listItem.data('checked'))
			children.remove();
			listItem.append(checkbox)
				.append($('<label for="' + id + '">')
					.append(text ? text : children.first())
				)
				.append(text ? children : children.slice(1));
			if( this.options.handleDuplicateCheckboxes ) {
				this.handleDuplicates(checkbox);
			}
		},
		handleDuplicates: function( checkbox ) {
			var self = this;
			checkbox.bind('change', function(e) {
				if( !e.duplicatesHandled ) {
					if( this.value ) {
						// select all duplicate checkboxes within the same scope
						$('input[type=checkbox]', self.options.scope)
							.filter('[value="' + this.value + '"]')
							// copy checked and indeterminate to the duplicate
							.prop({
								checked: $(this).prop('checked'),
								indeterminate: $(this).prop('indeterminate')
							})
							// and trigger their change event to update any parents
							.filter(function() {
								// but avoid a loop
								return this != e.target;
							})
							.trigger({
								type: 'change',
								duplicatesHandled: true
							});
					}
				}
				return true;					
			});
		},
		idPrefix: 'checkbox-',
		generateId: function( listItem ) {
			do {
				var id = this.idPrefix + Bonsai.uniqueId++;
			}
			while( $('#' + id).length > 0 );
			return id;
		},
		getCheckboxName: function( listItem ) {
			return listItem.data('name')
				|| listItem.parents().filter('[data-name]').data('name');
		},
		addExpandAll: function() {
			var self = this,
				scope = this.options.scope;
			$('<div class="expand-all">')
				.append($('<a class="all">Expand all</a>')
					.bind('click', function() {
						self.expandAll();
					})
				)
				.append('<i class="separator"></i>')
				.append($('<a class="none">Collapse all</a>')
					.bind('click', function() {
						self.collapseAll();
					})
				)
				.insertBefore(this.el);
		},
		addSelectAll: function() {
			var scope = this.options.scope;
			$('<div class="check-all">')
				.append($('<a class="all">Select all</a>')
					.bind('click', function() {
						$('input[type=checkbox]', scope).prop({
							checked: true,
							indeterminate: false
						});
					})
				)
				.append('<i class="separator"></i>')
				.append($('<a class="none">Select none</a>')
					.bind('click', function() {
						$('input[type=checkbox]', scope).prop({
							checked: false,
							indeterminate: false
						});
					})
				)
				.insertAfter(this.el);
		}
	};
	$.extend(Bonsai, {
		uniqueId: 0
	});
}(jQuery));