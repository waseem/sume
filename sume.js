Sume = {
  start: function() {
    new Sume.SearchRouter();
  }
}

Sume.SearchResult = Backbone.Model.extend({})
Sume.SearchResultList = Backbone.Collection.extend({
  model: Sume.SearchResult
})
Sume.searchResults = new Sume.SearchResultList()

Sume.SearchEngine = {
  search: function() {
    $('#search_autocomplete').hide();
    active = $('#search_autocomplete li.active')
    if (active.length > 0) {
      term = $.trim(active.text())
    }
    else {
      term = location.hash.replace("%23", "#").split("/")[2]
    }

    if (Sume.paths[term]) {
      $.get("doc/" + Sume.paths[term], function(html) {
        $('#docs').html(html)
      })
      Backbone.history.navigate("!/search/" + term, false)
    }
    else {
      $('#docs').html("<br><h4>Hmm... we couldn't find what you were looking for, sorry!</h4>")
    }
  }
}

Sume.AutoCompleteController = {
  areas: { "AR": "ActiveRecord",
           "AC": "ActionController" },

  // Used to parse strings such as:
  // find in AR (ActiveRecord::FinderMethods#find)
  // AR find (ActiveRecord::FinderMethods#find)
  // AC redirect_to (ActionController::Redirecting#redirect_to)
  filter_by_area: function(term, area) {
    if (this.areas[area]) {
      area = this.areas[area]
    }
    unfiltered_results = this.lookup(term)
    filtered_results = unfiltered_results.filter(function(result) {
      return result.search(new RegExp(area + ".*" + term, "i")) != -1
    })
    return filtered_results
  },

  fuzzies: [/[A-Z]\w+\.find/],
  fuzzy_matches: ["ActiveRecord::FinderMethods#find"],

  fuzzy_lookup: function(term) {
    var fuzzy_results = $.grep(this.fuzzies, function(fuzzy_key) {
      return term.match(fuzzy_key)
    })

    for (var key in fuzzy_results) {
      index = $.inArray(fuzzy_results[key], this.fuzzies)
      fuzzy_results[key] = this.fuzzy_matches[index]
    }
    return fuzzy_results
  },

  lookup: function(term) {
    var results = $.grep(Sume.index, function(element) {
      return element.search(new RegExp(term, "i")) != -1;
    })
    return results
  },


  search: function(term) {
    $('#search_autocomplete').show()
    $('#search_autocomplete').empty()
    // Supports things like "find in AR"
    if (term.search(" in ") > 0) {
      parts = term.split(" ")
      term = parts[0]
      area = parts[2]
      results = this.filter_by_area(term, area)
      fuzzy_results = []
    }
    // Supports things like "AR find"
    else if (term.search(" ") > 0) {
      parts = term.split(" ")
      term = parts[1]
      area = parts[0]
      results = this.filter_by_area(term, area)
      fuzzy_results = []
    }
    else {
      results = this.lookup(term)
      fuzzy_results = this.fuzzy_lookup(term)
    }

    results = results.concat(fuzzy_results)

    results.sort(function(result, other_result) {
      result_weight = Sume.weights[result] || 0
      other_result_weight = Sume.weights[other_result] || 0
      if (result_weight < other_result_weight) {
        return 1
      }
      else if (result_weight > other_result_weight) {
        return -1
      }
      else {
        return 0
      }
    })

    $.each(results.slice(0,10), function (index, term) {
      Sume.searchResults.add({term : term})
    })

    $('#search_autocomplete li').first().addClass('active')
  }
}

Sume.SearchResultsView = Backbone.View.extend({
  el: '#search_autocomplete',

  initialize: function() {
    Sume.searchResults.bind('add', this.renderItem, this)
  },

  renderItem: function(model) {
    var view = new Sume.SearchResultView({model : model})
    $(this.el).append(view.el)
  }
})

Sume.SearchResultView = Backbone.View.extend({
  tagName: 'li',

  events: {
    'hover': 'makeActive',
    'click': 'retrieve'
  },

  initialize: function() {
    this.template = _.template($('#autocompleteTemplate').html())
    this.render()
  },

  render: function() {
    var html = this.template({model : this.model.toJSON()})
    $(this.el).append(html)
  },

  makeActive: function() {
    $(this.el).siblings('.active').removeClass('active')
    $(this.el).addClass('active')
  },

  retrieve: function() {
    Sume.SearchEngine.search();
  }
})

Sume.SearchRouter = Backbone.Router.extend({

  routes: {
    '!/autocomplete/:term' : 'autocomplete',
    '!/search/:term': 'search'
  },

  initialize: function() {
    new Sume.SearchView({router : this})
    new Sume.SearchResultsView();
  },

  autocomplete: function(term) {
    Sume.AutoCompleteController.search(term)
  },

  search: function(term) {
    Sume.SearchEngine.search(term)
  }
})

Sume.SearchView = Backbone.View.extend({

  el: '#search',
  events: {
    'keyup' : 'autocomplete',
  },

  initialize: function() {
    $(this.el).focus()
    this.router = this.options.router
  },

  autocomplete: function(e) {
    if (e.keyCode != 13) {
      if ($(this.el).val().length >= 2) {
        this.router.navigate('!/autocomplete/' + $(this.el).val(), true)
      }
    }
  }
})

$(document).keydown(function(e){
  if (e.keyCode == 13) {
    Sume.SearchEngine.search();
  }

  if (e.keyCode == 38) {
    element = $('ul#search_autocomplete .active')
    if (element.length > 0) {
      previous = element.prev('li')
      if (previous.length > 0) {
        element.removeClass('active')
        previous.addClass('active')
      }
    }
    else {
      console.log($('ul#search_autocomplete li').first())
      $('ul#search_autocomplete li').first().addClass('active')
    }
    return false;
  }
  else if (e.keyCode == 40) {
    element = $('ul#search_autocomplete .active')
    if (element.length > 0) {
      next = element.next('li')
      if (next.length > 0) {
        element.removeClass('active')
        element.next('li').addClass('active')
      }
    }
    else {
      $('ul#search_autocomplete li').first().addClass('active')
    }
    return false;
  }
});

$(document).ready(function (e) {
  Sume.start();
  Backbone.history.start();
})
