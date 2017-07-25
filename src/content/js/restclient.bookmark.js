/* ***** BEGIN LICENSE BLOCK *****
Copyright (c) 2007-2012, Chao ZHOU (chao@zhou.fr). All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the author nor the names of its contributors may
      be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * ***** END LICENSE BLOCK ***** */

"use strict";

restclient.bookmark = {
  scrollProcessing: false,
  cachedRequests: new Array(),
  callback: null,
  init: function(){
    restclient.bookmark.initLabels();
    restclient.bookmark.updateRequests(0);
    $('#bookmark-sidebar').show();
    var bgColor = $('body').css('background-color');
    $('#bm-sidebar-inner').css('background-color', bgColor);
  },
  unload: function(){
    if(!$('#bookmark-sidebar').is(':visible'))
      return false;
    $('#bookmark-sidebar').hide();
    $('#bookmark-sidebar #bm-labels .edit').text('edit').attr('data-state', 'normal');
    $('#bookmark-sidebar .labels-panel').empty();
  },
  initLabels: function(){
    var labels = restclient.sqlite.getLabels();
    var selectedLabels = restclient.getPref('bookmark.selectedLabels', '[]');
    selectedLabels = JSON.parse(selectedLabels);

    _.each(labels, function(value, label){
      var div = $('<div class="label-div" />');
      
      var icon = $('<i class="fa fa-trash-o remove fa-lg hide"></i>').bind('click', restclient.bookmark.clickTrashLabel);
      var span = $('<span />').addClass('label').attr('data-label', label).attr('data-num', value)
                  .text(" " + label + " (" + value + ")").bind('click', restclient.bookmark.clickLabel);
      
      if(_.indexOf(selectedLabels, label) >= 0)
        span.addClass('label-important');          
      div.append(icon).append(span);
      $('.labels-panel').append(div);
    });
  },
  initScrollbarSize: function(){
    var scrollbarHeight = $('.bookmark-sidebar-scrollbar').outerHeight(),
        sidebarHeight = $('#bm-sidebar-inner').outerHeight(),
        sidebarContentHeight = $('#bm-requests').outerHeight() + $('#bm-labels').outerHeight() + $('#bm-footer').outerHeight();
    var ratio = Math.floor(sidebarContentHeight /sidebarHeight);
    var sliderHeight = Math.floor(scrollbarHeight / ratio);
    var sliderTop = Math.floor($('#bm-sidebar-inner').scrollTop() / ratio);
    $('.bookmark-sidebar-scrollbar .scrollbar-slider').css('height', sliderHeight).css('top', sliderTop);
  },
  scrollWindow: function(event){
    if( restclient.bookmark.scrollProcessing )
      return false;
    restclient.bookmark.scrollProcessing = true;
    if ($('#bm-sidebar-inner').scrollTop() >= $('#bm-requests').height() + $('#bm-labels').height() + $('#bm-footer').height() - $('#bm-sidebar-inner').height() - 400){
      var num = $('#bm-requests li[data-uuid]').length;
      var requestNum = parseInt($('#bm-requests .requestNum').text());
      if(num < requestNum)
      {
        $('.loading').show();
        restclient.bookmark.updateRequests(num);
        $('.loading').hide();
      }
    }
    restclient.bookmark.scrollProcessing = false;
  },
  scrollToTop: function(){
    $('#bm-sidebar-inner').scrollTop(0);
    return false;
  },
  clickLabel: function(){
    $(this).toggleClass('label-important');
    var spans = $('.labels-panel .label-important');
    var labels = [];
    for(var i=0, span; span = spans[i]; i++) {
      labels.push($(span).attr('data-label'));
    }
    restclient.setPref('bookmark.selectedLabels', JSON.stringify(labels));
    
    restclient.bookmark.updateRequests(0);
    return false;
  },
  clickLabelEdit: function(){
    if($(this).attr('data-state') === 'normal')
    {
      $(this).text('cancel').attr('data-state', 'edit');
      $('#bm-labels .remove').show();
    }
    else
    {
      $(this).text('edit').attr('data-state', 'normal');
      $('#bm-labels .remove').hide();
    }
    return false;
  },
  clickTrashLabel: function() {
    var label = $(this).next().attr('data-label');
    $('#modal-label-remove').data('source', $(this));
    $('#modal-label-remove').data('label', label).modal('show');
  },
  clickRemoveBookmark: function() {
    var uuid = $(this).parents('li').attr('data-uuid');
    var ret = restclient.sqlite.removeRequest(uuid);
    if(ret === true) {
      $(this).parents('li').remove();
      var spans = $(this).parents('li').find('.used-label');
      var reload = false;
      for(var i = 0, span; span = spans[i]; i++)
      {
        var label = $(span).text();
        var num = $('[data-label="' + label + '"]').attr('data-num');
        num = parseInt(num);
        num--;
        $('[data-label="' + label + '"]').attr('data-num', num).text(label + '(' + num + ')');
        if(num === 0) {
          if(reload === false && $('[data-label="' + label + '"]').hasClass('label-important'))
            reload = true;
            
          $('[data-label="' + label + '"]')
            .one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){ $(this).hide().remove(); })
            .addClass('animated fadeOut');
        }
      }
      if(reload)
        setTimeout(function() { restclient.bookmark.updateRequests(0); }, 500);
      
      var requestNum = $('#bm-requests .requestNum');
      requestNum.text(parseInt(requestNum.text()) - 1);
    }
    return false;
  },
  removeLabel: function(cascade) {
    var ret,label = $('#modal-label-remove').data('label');
    ret = restclient.sqlite.removeLabel(label, cascade);
    if(ret === true) {
      $('#modal-label-remove .btnClose').last().click();
      var source = $('#modal-label-remove').data('source');
      var div = source.parent();

      setTimeout(function(){
        div.one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){ 
          $(this).hide().remove(); 
          restclient.bookmark.updateRequests(0);
        });
        div.addClass('animated bounceOutUp');
      }, 500);
    }
    else
    {
      var message = restclient.message.show({
        id: 'alert-remove-label-failed',
        type: 'error',
        title: 'Cannot remove the label',
        message: 'Cannot remove the label, something is wrong.',
        buttons: [
          {title: 'Close', class: 'btn-danger', callback: function () { $('#alert-remove-label-failed').alert('close').remove(); }}
        ],
        exclude: true,
        prepend: true,
        parent: $('#modal-label-remove .modal-body')
      });
    }
    return false;
  },
  updateRequests: function(offset) {
    if(typeof offset === 'undefined') {
      offset = 0;
    }
    if(offset === 0) {
      $('.bookmark-requests').html('');
      restclient.bookmark.cachedRequests = new Array();
    }

    var labelSelected = $('.labels-panel .label-important');
    var labels = [];

    for(var i=0, lab; lab = labelSelected[i]; i++){
      labels.push($(lab).attr('data-label'));
    }
    
    var keyword = '';
    var requestNum = restclient.sqlite.countRequestsByKeywordAndLabels(keyword, labels);
    $('.requestNum').text(requestNum);
    var requests = restclient.sqlite.findRequestsByKeywordAndLabels(keyword, labels, offset);
    if(requests === false)
      return false;
    requests = requests.map(function(record) {
      record.request = JSON.parse(record.request);
      return record;
    });

    restclient.bookmark.cachedRequests = restclient.bookmark.cachedRequests.concat(requests);
    
    var templateHtml = $('#bookmarkRequest').html();
    var template = $(_.template(templateHtml, {items: requests}));
    template.find('a.favorite').on('click', restclient.bookmark.toggleFavorite);
    template.find('.removeBookmark').on('click', restclient.bookmark.clickRemoveBookmark);
    template.find('.restore, .restoreAPS').on('click', restclient.bookmark.applyRequest);
    template.find('.replace').on('click', restclient.bookmark.replaceRequest);
    $('.bookmark-requests').append(template);
  },
  toggleFavorite: function(e) {
    var uuid = $(this).parents('li').attr('data-uuid');
    var favorite = $(this).attr('data-favorite');
    favorite = (favorite === '0') ? 1 : 0;
    var ret = restclient.sqlite.updateRequestFavorite(uuid, favorite);
    if(ret === true) {
      $(this).attr('data-favorite', favorite);
      $(this).find('i').toggleClass('fa-star fa-star-o');
    }
    //TODO if fails...
    return false;
  },
  applyRequest: function(){
    var e = $(this),
        uuid = e.parents('li').attr('data-uuid'),
        request = _.where(restclient.bookmark.cachedRequests, {uuid: uuid});
    if(request.length > 0) {
      restclient.main.applyRequest(request[0].request, e.hasClass('restoreAPS'));
      restclient.bookmark.unload();
    }
    return false;
  },
  replaceRequest: function(){
    var e = $(this),
        uuid = e.parents('li').attr('data-uuid'),
        requestOld = _.where(restclient.bookmark.cachedRequests, {uuid: uuid})[0],
        requestNew = restclient.main.getRequest();
    if (!restclient.helper.validateUrl(requestNew.url))
    {
      restclient.message.show({
        id: 'alertInvalidRequestUrl',
        type: 'error',
        title: 'The request URL is invalid',
        message: 'To bookmark a request you must input a valid request URL!',
        buttons: [
          {title: 'Okay', class: 'btn-danger', callback: function () { $('#request-url').focus().select(); $('#alertInvalidRequestUrl').alert('close');  }}
        ],
        parent: $('#request-error'),
        exclude: true
      });
      return false;
    }
    $('#modal-bookmark-update [name=updated-request-name]').val(requestOld.requestName);
    $('#modal-bookmark-update [name=bookmark-uuid]').val(uuid);
    $('#modal-bookmark-update').modal('show');
    $('#modal-bookmark-update [name=updated-as-favorite-checkbox]').bootstrapSwitch('state', requestOld.favorite);
    return false;
  },
  updateCurrentRequest: function(){
    //TODO update save CurrentRequest function
    var requestNameEl = $('#modal-bookmark-update [name="updated-request-name"]'),
        requestName = requestNameEl.val();
    if (requestName == '') {
      requestNameEl.next().text('Please give this request a name for future usage.').show();
      requestNameEl.focus();
      return false;
    }
    var labels = $('#modal-bookmark-update [name="updated-request-label"]').tagsinput('items');
    var favorite = $('[name="updated-as-favorite-checkbox"]').bootstrapSwitch('state') ? 1 : 0;
    var request = restclient.main.getRequest();
    var uuid = $('[name=bookmark-uuid]').val();
    
    var requestId = restclient.sqlite.updateRequest(uuid, request, requestName, favorite, labels);
    if(requestId !== false)
    {
      $('#modal-bookmark-update').modal('hide');
      $('.request-menu').click();
      restclient.bookmark.updateRequests(0);
    }
    else
    {
      var message = restclient.message.show({
        id: 'alert-save-bookmark-failed',
        type: 'error',
        title: 'Cannot bookmark this request',
        message: 'Cannot bookmark this request to local cache, something goes wrong...',
        buttons: [
          {title: 'Close', class: 'btn-danger', callback: function () { $('#alert-save-bookmark-failed').alert('close').remove(); }}
        ],
        exclude: true,
        prepend: true,
        parent: $('#modal-bookmark-update form')
      });
    }
  }
};
