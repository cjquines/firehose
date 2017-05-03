var table;
var buttons = {};
var rs, hs, elig, res;
var hass_a_active, hass_h_active, hass_s_active, ci_h_active, ci_hw_active, conflicts_active;
var cur_class;
var cur_classes = [];
var options;
var cur_option;
var cur_min_conflicts = 0;
var all_sections;
var calc_classes = [];
var calc_slots = [];
var conflicts_flag;
var activities = [];

var colors = ["#16A085", "#2980B9", "#9B59B6", "#C0392B", "#D35400", "#7F8C8D", "#27AE60"]

Number.prototype.format = function(n, x) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
    return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
};

String.prototype.paddingLeft = function (paddingValue) {
   return String(paddingValue + this).slice(-paddingValue.length);
};

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}


function class_sort_internal(a, b) {
    var mult;
    var len;
    
    if (a.length < b.length) {
	return -1
    } else if (a.length > b.length) {
	return 1;
    }

    for (i = 0; i < a.length; i++) {
	if (a.charAt(i) < b.charAt(i)) {
	    return -1;
	}
	else if (a.charAt(i) > b.charAt(i)) {
	    return 1;
	}
    }

    return 0;
}

function class_sort_internal2(a, b) {
    var mult;
    var len;
    
    if (a.length < b.length) {
	mult = -1;
	len = a.length;
    } else if (a.length > b.length) {
	mult = 1;
	len = b.length;
    } else {
	mult = 0;
	len = a.length;
    }

    for (i = 0; i < len; i++) {
	if (a.charAt(i) < b.charAt(i)) {
	    return -1;
	}
	else if (a.charAt(i) > b.charAt(i)) {
	    return 1;
	}
    }

    return mult;	
}

function class_sort(a, b) {
    var a_s = a.split('.');
    var b_s = b.split('.');

    var sort = class_sort_internal(a_s[0], b_s[0]);

    if (sort === 0) {
	sort = class_sort_internal2(a_s[1], b_s[1]);
    }

    return sort;
}

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    "class-asc": function (a, b) {
        return class_sort(a, b);
    },
    "class-desc": function (a, b) {
        return class_sort(a, b) * -1;
    }
} );

$.fn.dataTable.ext.search.push(
    function( settings, data, dataIndex ) {
	if (!(isNaN(rs))) {
	    if (rs > parseFloat(data[1])) {
		return false;
	    }
	}

	if (!(isNaN(hs))) {
	    if (hs < parseFloat(data[2])) {
		return false;
	    }
	}

	return true;
    }
);

function search_setup() {
    $('#class-input').on( 'keyup', function () {
        if (table.column(0).search() !== this.value ) {
            table.column(0)
                .search("^" + escapeRegExp(this.value), true, false, true)
                .draw();
            }
    });
}

function add_cal(number, type, room, slot, length) {
    var day = Math.floor(slot / 30) + 1;
    var hour = (Math.floor((slot % 30) / 2) + 8).toString().paddingLeft("00");
    var minute = ((slot % 2) * 30).toString().paddingLeft("00");

    var end_hour = (Math.floor(((slot + length) % 30) / 2) + 8).toString().paddingLeft("00");
    var end_minute = (((slot + length) % 2) * 30).toString().paddingLeft("00");

    var type_full = '';

    if (type == 'l') {
	type_full = 'lec';
    } else if (type == 'r') {
	type_full = 'rec';
    } else if (type == 'b') {
	type_full = 'lab';
    } 

    var index = cur_classes.indexOf(number);
    var color = colors[index % colors.length];
    
    var event = {
	title: number + ' ' + type_full + '\n' + room,
	start: '2016-08-0' + day + 'T' + hour + ':' + minute,
	end: '2016-08-0' + day + 'T' + end_hour + ':' + end_minute,
	backgroundColor: color
    };

    $("#calendar").fullCalendar('renderEvent', event, true);

    var n_number = number.replace('.', "").replace(' ', "");
    $("#" + n_number + "-button").css({
	"background-color": color,
	"border-color": color,
	"color": "#ffffff"
    });
}

function conflict_check(slot1, slot2) {
    return ((slot1[0] < slot2[0] + slot2[1]) &&
	    (slot2[0] < slot1[0] + slot1[1]))
}

function select_helper(all_sections, chosen_slots, chosen_options, cur_conflicts, min_conflicts) {
    var chosen = [];
    
    if (all_sections.length == 0) {
	return [[chosen_options], cur_conflicts]
    }

    var slot;
    var new_conflicts;
    var out;

    var new_all_sections = all_sections.slice();
    new_all_sections.shift();
    
    var section = all_sections[0];
    var slots = classes[section[0]][section[1]];

    for (var s in slots) {
	slot = slots[s][0];
	new_conflicts = 0;

	for (var cs in chosen_slots) {
	    for (var ss in slot) {
		if (conflict_check(slot[ss], chosen_slots[cs])) {
		    new_conflicts++;
		}
	    }
	}

	if (cur_conflicts + new_conflicts > min_conflicts) {
	    continue;
	}

	out = select_helper(new_all_sections,
			    chosen_slots.concat(slot),
			    chosen_options.concat(s),
			    cur_conflicts + new_conflicts,
			    min_conflicts);

	if (out[1] < min_conflicts) {
	    chosen = [];
	    min_conflicts = out[1];
	}

	if (out[1] == min_conflicts) {
	    chosen = chosen.concat(out[0]);
	}
    }

    return [chosen, min_conflicts]
}


function select_slots() {
    all_sections = [];
    for (var c in cur_classes) {
	for (var s in classes[cur_classes[c]]['s']) {
	    all_sections.push([classes[cur_classes[c]]['no'],
			       classes[cur_classes[c]]['s'][s]])
	}
    }
    all_sections.sort(function(a, b) {
	return (classes[a[0]][a[1]].length -
		classes[b[0]][b[1]].length);
    });

    var tmp = select_helper(all_sections, [], [], 0, 1000);
    options = tmp[0];
    cur_min_conflicts = tmp[1];

    set_option(0);
    $("#cal-options-2").text(options.length);
    var n_number;
    var units = 0;
    var hours = 0;
    var flag = false;
    var flag2 = false;
    var toappend;
    for (var c in cur_classes) {
	toappend = '';
	n_number = cur_classes[c].replace('.', "").replace(' ', "");
	units += classes[cur_classes[c]]['u1'] + classes[cur_classes[c]]['u2'] + classes[cur_classes[c]]['u3'];
	hours += classes[cur_classes[c]]['h'];
	
	if (classes[cur_classes[c]]['h'] === 0 && classes[cur_classes[c]]['s'][0] != 'a') {
	    toappend += '*';
	    flag = true;
	}
	
	if (classes[cur_classes[c]]['tb']) {
	    toappend += '+';
	    flag2 = true;
	}

	$('#' + n_number + '-button').text(cur_classes[c] + toappend);
    }
    $("#total-units").text(units);
    $("#total-hours").text(hours.format(1));
    
    if (flag) {
	$("#total-hours").append("*");
	$("#warning-div").show();
    } else {
	$("#warning-div").hide();
    }

    if (flag2) {
	$("#warning2-div").show();
    } else {
	$("#warning2-div").hide();
    }

    Cookies.set('cur_classes', cur_classes, { expires: 365 });
}

function set_option(index) {
    var option = options[index];
    var slots;

    $("#calendar").fullCalendar('removeEvents');

    for (var o in option) {
	slots = classes[all_sections[o][0]][all_sections[o][1]][option[o]];
	for (var s in slots[0]) {
	    add_cal(all_sections[o][0], all_sections[o][1], slots[1],
		    slots[0][s][0], slots[0][s][1]);
	}
    }

    cur_option = index;
    $("#cal-options-1").text(cur_option + 1);

    Cookies.set('cur_option', cur_option, { expires: 365 });
}

function conflict_helper(new_sections, old_slots) {
    var section;
    var slots;

    section_loop: for (var n in new_sections) {
	section = new_sections[n];
	slots = classes[section[0]][section[1]];

	slot_loop: for (var s in slots) {
	    slot = slots[s][0];

	    for (var os in old_slots) {
		for (var ss in slot) {
		    if (conflict_check(slot[ss], old_slots[os])) {
			continue slot_loop;
		    }
		}
	    }

	    continue section_loop;
	}

	return false;
    }

    return true;
}

function is_selected(number) {
    var selected = false;

    if (hass_a_active || hass_h_active || hass_s_active) {
	if (hass_a_active) {
	    if (classes[number]['ha']) {
		selected = true;
	    }
	}

	if (hass_h_active) {
	    if (classes[number]['hh']) {
		selected = true;
	    }
	}

	if (hass_s_active) {
	    if (classes[number]['hs']) {
		selected = true;
	    }
	}

	if (!selected) {
	    return false;
	}
    }

    selected = false;

    if (ci_h_active || ci_hw_active) {
	if (ci_h_active) {
	    if (classes[number]['ci']) {
		selected = true;
	    }
	}

	if (ci_hw_active) {
	    if (classes[number]['cw']) {
		selected = true;
	    }
	}

	if (!selected) {
	    return false;
	}
    }

    selected = false;

    if (conflicts_active) {
	if (!conflicts_flag) {
	    var option;
	    var section;
	    var slots;
	    var slot;
	    
	    calc_classes = cur_classes.slice();
	    calc_slots = [];

	    for (var op in options) {
		option = options[op];
		slots = [];
		
		for (var o in option) {
		    slots.push.apply(slots, classes[all_sections[o][0]][all_sections[o][1]][option[o]][0]);
		}

		calc_slots.push(slots);
	    }

	    conflicts_flag = true;
	}

	if (cur_classes.length == 0) {
	    return true;
	}

	var class_slots = [];

	for (var s in classes[number]['s']) {
	    class_slots.push([classes[number]['no'],
			      classes[number]['s'][s]]);
	}

	if (class_slots.length == 0) {
	    return false;
	}

	for (var c in calc_slots) {
	    if (conflict_helper(class_slots, calc_slots[c])) {
		return true;
	    }
	}

	return false;
    }

    return true;
}

function fill_table() {
    table.clear();

    hass_a_active = $("#hass-a").is(":checked");
    hass_h_active = $("#hass-h").is(":checked");
    hass_s_active = $("#hass-s").is(":checked");
    ci_h_active = $("#ci-h").is(":checked");
    ci_hw_active = $("#ci-hw").is(":checked");
    conflicts_active = $("#conflicts").is(":checked");
    conflicts_flag = false;
    
    for (var c in classes) {
	if (is_selected(c)) {
	    table.rows.add([[classes[c]['no'],
	   		     classes[c]['ra'].format(1),
	   		     classes[c]['h'].format(1),
	   		     classes[c]['n']]]);
	}
    }

    if ($('#class-input').val() != '' || hass_a_active || hass_h_active ||
	hass_s_active || ci_h_active || ci_hw_active || conflicts_active) {
	table.page.len(2000);
    } else {
	table.page.len(150);
    }
    
    table.draw();

    search_setup();

    $('#apply').blur();
}

function class_desc(number) {
    $('#class-name').text(classes[number]['no'] + ': ' + classes[number]['n']);
    $('.type-span').hide();

    if (classes[number]['nx']) {
	$('#nonext-span').show();
    }

    if (classes[number]['le'] == 'U') {
	$('#under-span').show();
    }
    else if (classes[number]['le'] == 'G') {
	$('#grad-span').show();
    }
    
    if (classes[number]['t'].indexOf('FA') != - 1) {
	$('#fall-span').show();
    }
    if (classes[number]['t'].indexOf('JA') != - 1) {
	$('#iap-span').show();
    }
    if (classes[number]['t'].indexOf('SP') != - 1) {
	$('#spring-span').show();
    }
    if (classes[number]['t'].indexOf('SU') != - 1) {
	$('#summer-span').show();
    }

    $('#end-paren-span').show();

    if (classes[number]['rp']) {
	$('#repeat-span').show();
    }

    if (classes[number]['re']) {
	$('#rest-span').show();
    }

    if (classes[number]['la']) {
	$('#Lab-span').show();
    }

    if (classes[number]['pl']) {
	$('#PartLab-span').show();
    }

    if (classes[number]['hh']) {
	$('#hassH-span').show();
    }

    if (classes[number]['ha']) {
	$('#hassA-span').show();
    }

    if (classes[number]['hs']) {
	$('#hassS-span').show();
    }

    if (classes[number]['he']) {
	$('#hassE-span').show();
    }

    if (classes[number]['ci']) {
	$('#cih1-span').show();
    }
    
    if (classes[number]['cw']) {
	$('#cihw-span').show();
    }

    var u1 = classes[number]['u1'];
    var u2 = classes[number]['u2'];
    var u3 = classes[number]['u3'];
    
    if (classes[number]['f']) {
	$('#final-span').show();
    }

    $('#class-prereq').html('Prereq: ');
    
    var to_append;
    var lp;
    var n_number;
    var prereq_text = '';
    var prereq_split = classes[number]['pr'].split(" ");
    for (var p in prereq_split) {
	lp = prereq_split[p];
	to_append = '';

	if (lp.indexOf(',') != -1) {
	    to_append += ',';
	    lp = lp.replace(',', '');
	}

	if (lp.indexOf(';') != -1) {
	    to_append += ';'
	    lp = lp.replace(';', '');
	}

	
	if (lp in classes) {
	    n_number = lp.replace('.', "").replace(' ', "");
	    $('#class-prereq').append('<span class="prereq-span" id="prereq-' + n_number + '">' + lp + '</span>' + to_append + ' ');
	    
	    (function() {
		var tmp_str = lp;
		$('#prereq-' + n_number).click(function () {
		    class_desc(tmp_str);
		});
	    })();
	} else {
	    $('#class-prereq').append(lp + to_append + ' ');
	}
    }
    
    $('#class-units').text((u1 + u2 + u3) + ' units: ' + u1 + '-' + u2 + '-' + u3);

    $('#class-rating').text((classes[number]['ra']).format(1));
    $('#class-hours').text((classes[number]['h']).format(1));
    $('#class-people').text((classes[number]['si']).format(1));
    $('#class-eval').show();

    $('#class-desc').html(classes[number]['d'] + '<br><br><a href="http://student.mit.edu/catalog/search.cgi?search=' + number +
			  '" target="_blank">Course Catalog</a> | <a href="https://sisapp.mit.edu/ose-rpt/subjectEvaluationSearch.htm?search=Search&subjectCode=' +
			  number + '" target="_blank">Class Evaluations</a>');

    cur_class = number;

    n_number = number.replace('.', "").replace(' ', "");

    if (cur_classes.indexOf(number) == -1) {
	$('#class-buttons-div').html('<button type="button" class="btn btn-primary" id=' + n_number + '-add-button>Add class</button>');

	$('#' + n_number + '-add-button').click(function () {
            add_class(number);
	});
    } else {
	$('#class-buttons-div').html('<button type="button" class="btn btn-primary" id=' + n_number + '-remove-button>Remove class</button>');

	$('#' + n_number + '-remove-button').click(function () {
            remove_class(number);
	});
    }
    
}

function add_class(number) {
    if (cur_classes.indexOf(number) == -1) {
	var n_number = number.replace('.', "").replace(' ', "");
    
	$('#selected-div').append('<button type="button" class="btn btn-primary" id=' + n_number + '-button>' + number + '</button>');

	$('#' + n_number + '-button').click(function () {
            class_desc(number);
	});

	$('#' + n_number + '-button').dblclick(function () {
            remove_class(number);
	});

	cur_classes.push(number);
	try { class_desc(number); }
	catch (err) {}
	select_slots();
	$("#units-div").show();
    }
}

function remove_class(number) {
    var n_number = number.replace('.', "").replace(' ', "");
 
    $('#' + n_number + '-button').remove();

    cur_classes.splice(cur_classes.indexOf(number), 1);
    class_desc(number);
    if (cur_classes.length == 0) {
	options = [[]];
	cur_option = 0;
	$("#cal-options-1").text('1');
	$("#cal-options-2").text('1');
	$("#calendar").fullCalendar('removeEvents');
	$("#units-div").hide();
	$("#warning-div").hide();
	$("#warning2-div").hide();
	Cookies.set('cur_classes', cur_classes, { expires: 365 });
	Cookies.set('cur_option', cur_option, { expires: 365 });
    } else {
	select_slots();
    }
}

function add_activity() {
    var days = [$("#act-mon").is(":checked"), $("#act-tue").is(":checked"),
		$("#act-wed").is(":checked"), $("#act-thu").is(":checked"),
		$("#act-fri").is(":checked")];
    var name = $("#activity-input").val();
    var time0 = $("#time-slider").slider("values", 0);
    var time1 = $("#time-slider").slider("values", 1);

    var slots = [];
    var flag = false;
    
    for (var i = 0; i < 5; i++) {
	if (days[i]) {
	    slots.push([i * 30 + time0, time1 - time0]);
	    flag = true;
	}
    }

    if (flag == false) {
	return;
    }

    var activity = {
	'no': name,
        'co': '',
        'cl': '',
        'f': false,
        'tb': false,
        's': ['a'],
        'a': [[slots, '']],
	'hh': false,
        'ha': false,
        'hs': false,
        'he': false,
        'ci': false,
        'cw': false,
        'rp': false,
        're': false,
        'la': false,
        'pl': false,
        'u1': 0,
        'u2': 0,
        'u3': 0,
        'le': 'U',
        't': ['FA'],
        'pr': 'None',
        'd': 'Your activity!',
        'n': name,
	'ra': 0,
	'h': 0,
	'si': 0
    };

    activities.push(activity);
    classes[name] = activity;
    add_class(name);
    select_slots();

    Cookies.set('activities', activities, { expires: 365 });
}

$(document).ready(function() {
    $('#calendar').fullCalendar({
	allDaySlot: false,
	columnFormat: 'dddd',
	defaultDate: '2016-08-01',
	defaultView: 'agendaWeek',
	editable: false,
	header: false,
	height: 698,
	minTime: "08:00:00",
	maxTime: "22:00:00",
	weekends: false,
	eventClick: function(calEvent, jsEvent, view) {
	    var name = calEvent.title.split(' ')[0];
	    class_desc(name);
	}
    });
    
    $('#eval-table tfoot th').each( function () {
        var title = $(this).text();
        $(this).html( '<input type="text" placeholder="Search '+title+'" />' );
    } );

    table = $("#eval-table").DataTable( {
	iDisplayLength: 150,
	sDom: "t",
	deferRender: true,
	order: [[0, "asc"]],
	columnDefs: [
	    { targets: [0],
	      type: "class",
	      render: function ( data, type, row, meta ) {
                  if (type === 'display'){
                      data =
			  '<a href="#">' + data + '</a>';
                }

                return data;
              } }
	],
	scrollY: "30vh"
    }); 

    fill_table();
    
    $("#eval-loading").hide();
    $("#eval-table-div").show();

    table.columns.adjust().draw();

    $("#class-input").on("keypress", function(e) {
        if (e.keyCode == 13) {
	    var c = $('#class-input').val().toUpperCase();
	    if (classes.hasOwnProperty(c)) {
		if (cur_classes.indexOf(c) == -1) {
		    add_class(c);
		} else {
		    remove_class(c);
		}
		$('#class-input').val('');
	    }
        }
    });

    $('#eval-table tbody').on('click', 'tr', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);

	class_desc(row.data()[0]);
    });
    
    $('#eval-table tbody').on('dblclick', 'tr', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);
	var c = row.data()[0];

	if (cur_classes.indexOf(c) == -1) {
	    add_class(c);
	} else {
	    remove_class(c);
	}
    });

    $("#cal-left").click( function () {
	set_option((cur_option + options.length - 1) % options.length);
	$("#cal-left").blur();
    });

    $("#cal-right").click( function () {
	set_option((cur_option + options.length + 1) % options.length);
	$("#cal-right").blur();
    });

    $("#activity-button").click( function () {
	if ($("#activity-div").is(":visible")) {
	    $("#activity-div").hide();
	    $("#activity-button").text("+ Add non-class activity");
	} else {
	    $("#activity-div").show();
	    $("#activity-button").text("- Hide non-class activity pane");
	}
    });

    $("#time-slider").slider({
        range: true,
        min: 0,
        max: 28,
        values: [4, 10],
        slide: function(event, ui) {
	    if (ui.values[0] === ui.values[1]) return false;
	    
	    var hour = (Math.floor((ui.values[0] % 30) / 2) + 8)
	    if (hour >= 12) {
		var ampm = " PM";
		if (hour > 12) {
		    hour -= 12;
		}
	    } else {
		var ampm = " AM";
	    }
	    var hour_str = hour.toString().paddingLeft("00");
	    var minute = ((ui.values[0] % 2) * 30).toString().paddingLeft("00");

	    var end_hour = (Math.floor((ui.values[1] % 30) / 2) + 8);
	    if (end_hour >= 12) {
		var end_ampm = " PM";
		if (end_hour > 12) {
		    end_hour -= 12;
		}
	    } else {
		var end_ampm = " AM";
	    }
	    var end_hour_str = end_hour.toString().paddingLeft("00");
	    var end_minute = ((ui.values[1] % 2) * 30).toString().paddingLeft("00");

	    $("#time").text(hour_str + ":" + minute + ampm + " - " + end_hour_str + ":" + end_minute + end_ampm);
	}
    });

    $("#add-activity-button").click( function() {
	add_activity();
    });

    $("#activity-input").on("keypress", function(e) {
        if (e.keyCode == 13) {
	    add_activity();
        }
    });

    $(".act-day").click( function() {
	var days = [$("#act-mon").is(":checked"), $("#act-tue").is(":checked"),
		    $("#act-wed").is(":checked"), $("#act-thu").is(":checked"),
		    $("#act-fri").is(":checked")];

	for (var i = 0; i < 5; i++) {
	    if (days[i]) {
		$('#add-activity-button').prop('disabled', false);
		return;
	    }
	}

	$('#add-activity-button').prop('disabled', true);
    });

    $("#prereg-link").click( function() {
	window.open("https://student.mit.edu/cgi-bin/sfprwtrm.sh?" + cur_classes.join(','), "_blank");
    });

    activities = Cookies.getJSON('activities');
    if (activities != null) {
	for (var a in activities) {
	    classes[activities[a]['no']] = activities[a];
	}
    } else {
	activities = [];
    }

    var tmp_cur_classes = Cookies.getJSON('cur_classes');
    var tmp_cur_option = parseInt(Cookies.get('cur_option'));

    if (tmp_cur_classes != null) {
	for (var t in tmp_cur_classes) {
	    if (tmp_cur_classes[t] in classes) {
		add_class(tmp_cur_classes[t]);
	    }
	}
	select_slots();
	if (tmp_cur_option < options.length) {
	    set_option(tmp_cur_option);
	}
    } else {
	cur_classes = [];
	cur_option = 0;
    }
});
