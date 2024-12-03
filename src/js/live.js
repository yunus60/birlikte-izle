const listCountDown = {};

function liveItemUpdateState() {
    $(`.live-item`).each((index, element) => {
        const $this = $(element);
        const currentTime = Math.floor(Date.now() / 1000);
        const airTime = $this.data('air-time');
        if (airTime > currentTime && !$this.hasClass('item-countdown')) {
            let diffTime = airTime - currentTime;
            const interval = 1000;

            if (diffTime <= 0) {
                $this.find('#state-live').show();
            } else {
                $this.addClass('item-countdown');
                listCountDown[$this.data('id')] = setInterval(function () {
                    if (diffTime <= 0) {
                        $this.find('#state-live').show();
                        $this.find('.live-tick-countdown').hide();
                        clearInterval(listCountDown[$this.data('id')]);
                    } else {
                        $this.find('.live-tick-countdown').show();
                        diffTime = diffTime - 1;
                        $this.find('.countdown').text(timeFormatBySeconds(diffTime));
                    }
                }, interval);
            }
        }
    });
}

function handleScrollToBottom(func) {
    window.onscroll = function () {
        if (window.innerHeight + window.scrollY >= (document.body.offsetHeight - 400)) {
            func();
        }
    }
}

var hasMore = true, cursor = '', loading = false, room = $('.live_content').data('room') || '';

function getLives(type = 'all') {
    if (!loading && hasMore) {
        $('#loading-data').show();
        loading = true;
        $.get(`/ajax/watch2gether/list?type=${type}&cursor=${cursor}&status=${room}`, function (res) {
            hasMore = res.hasMore;
            cursor = res.nextCursor;
            $('.live__-wrap').append(res.html);

            loading = false;
            $('#loading-data').hide();

            liveItemUpdateState();
        })
    }
}

if (window.location.pathname === "/watch2gether") {
    $('#currentRooms').text($('#dropdownRooms .dropdown-item.added').text());

    handleScrollToBottom(getLives);

    getLives();

    const socket = io(socketUrl, {transports: ["websocket", "polling"], withCredentials: true});
    socket.on('updateAllRoomsInfo', function (data) {
        for (const [key, value] of Object.entries(data)) {
            if ($(`#live-${key}`).find('.live-tick-ended').length <= 0 && value > 0) {
                $(`#live-${key} .live-tick-viewer`).text(`${value} viewers`);
            }
        }
    })
}
if (window.location.pathname === "/watch2gether/my-rooms") {
    function getMyRooms() {
        getLives('my_rooms');
    }

    getMyRooms();
    handleScrollToBottom(getMyRooms);
}

if (window.location.pathname.match("/watch2gether/create")) {
    $('.source-type').first().click();
    const roomData = {
        air_time: 0,
        is_private: 0,
        source_type: $('.source-type.active').data('type'),
        movie_id: $('.live_content').data('movie-id')
    };
    const airTimePicker = $('#air-time');
    airTimePicker.bootstrapMaterialDatePicker({
        format: 'HH:mm YYYY/MM/DD',
        nowButton: true,
        minDate: new Date(),
        maxDate: moment().add(30, 'days')
    });
    airTimePicker.on('change', (event, date) => {
        roomData.air_time = date.unix();
    });
    $('.room-public').click(function () {
        roomData.is_private = $(this).hasClass('off') ? 0 : 1;
    });
    $('.source-type').click(function () {
        roomData.source_type = $(this).data('type');
    });
    var loading = false;
    $('.btn-create-room').click(function () {
        if (!loading) {
            loading = true;
            $('#loading').show();
            $('#create-alert-error').hide();
            roomData.title = $('input[name="room_name"]').val();
            if (roomData.title.trim().length === 0) {
                showError('- Room name is required.');
            } else if ($('.start-auto').hasClass('active') && roomData.air_time === 0) {
                showError('- Please set a Start Time for this room.');
            } else {
                $.post('/ajax/watch2gether/create-room', roomData, function (res) {
                    if (res.status) {
                        window.location.href = res.redirectTo;
                    } else {
                        var err = '';
                        if (res.errors) {
                            res.errors.forEach(function (e) {
                                err += `- ${e}<br>`;
                            })
                        } else {
                            err = res.msg;
                        }
                        showError(err);
                        setTimeout(function () {
                            $('#create-alert-error').hide();
                        }, 6000);
                    }
                    loading = false;
                    $('#loading').hide();
                })
            }
        }
    })

    function showError(err) {
        $('#create-alert-error').html(err);
        $('#create-alert-error').show();
        loading = false;
        $('#loading').hide();
    }
}
const regexW2gWatch = /\/watch2gether\/(\d+)/g;
const foundW2gWatch = regexW2gWatch.exec(window.location.pathname);
if (foundW2gWatch) {
    const playerWrapper = $(`#player-wrapper`);
    const playerContainer = $('#player-container');
    const playerMask = $('.player-mask');
    const liveId = playerWrapper.data('id');
    const isHost = Boolean(playerWrapper.data('is-host'));
    var airTime = parseInt(playerWrapper.data('air-time'));
    const status = parseInt(playerWrapper.data('status'));
    let isLive = false;

    const socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        query: {liveId}
    });
    socket.on("connect", () => {
        viewerConnect();
        // setTimeout(viewerConnect, 3000);
    });
    socket.on('updateRoomInfo', function (data) {
        $('#totalViewers').text(data.viewers);
        $('#totalUsers').text(data.users);

        data.owner_is_online ? $('.owner-status').removeClass('is-off').addClass('is-on').text('Online') : $('.owner-status').removeClass('is-on').addClass('is-off').text('Offline');
        $('.owner-status').show();
    })
    socket.on('startLive', function (data) {
        airTime = data.airTime;
        if (!isLive) createPlayer();
    })

    function getModalSettings() {
        $.get(`/ajax/watch2gether/modal-settings/${liveId}`, function (res) {
            $('#modalLiveSettings').html(res.html);
            if (isLive) $('.btn-endLive').show();
        })
    }

    if (isHost && status !== 34) {
        getModalSettings();
    }

    liveItemUpdateState();

    const initCountDownPlayer = () => {
        const currentTime = Math.floor(Date.now() / 1000);
        if (status === 35) {
            createPlayer();
        } else if (status === 34) {
            playerWrapper.addClass('ls___-player ls___-player-pending');
            $('.player-notice').show();
            $('.text-ended').show();
        } else if (airTime > 0) {
            playerWrapper.addClass('ls___-player ls___-player-cd');
            $('.player-countdown').show();
            let diffTime = airTime - currentTime;
            const interval = 1000;
            if (diffTime <= 0) {
                startLive();
            } else {
                const countdownInterval = setInterval(function () {
                    if (diffTime <= 0) {
                        startLive();
                        clearInterval(countdownInterval);
                    } else {
                        diffTime = diffTime - 1;
                        playerWrapper.find('#countdown').text(timeFormatBySeconds(diffTime));
                    }
                }, interval);
            }
        } else if (airTime === 0) {
            playerWrapper.addClass('ls___-player ls___-player-pending');
            $('.player-notice').show();
            $('.player-notice .pc-share').show();
            $('.text-start-manual').show();
            if (isHost) {
                $('.is-host').show();
            } else {
                $('.is-guest').show();
            }
        }
    }

    function startLive() {
        if (isHost) {
            $('.btn-endLive').show();
            const startLiveInterval = setInterval(function () {
                if (checkedLogin) {
                    socket.emit('startLive', {auth: {id_encrypt: loggedInfo.id_encrypt || null}});
                    clearInterval(startLiveInterval);
                }
            }, 100);
        }
        createPlayer();
    }

    function createPlayer() {
        isLive = true;

        playerWrapper.addClass('ls___-player');

        playerMask.hide();

        playerContainer.show();

        getEmbed();
    }

    function getEmbed() {
        $.get(`/ajax/watch2gether/getEmbed/${liveId}`, function (res) {
            $('#iframe-embed').attr('src', res.link);

            updatePassedTime();
        });
    }

    function getPassedTime() {
        const currentTime = Math.floor(Date.now() / 1000);
        return currentTime - airTime;
    }

    var updatePassedTimeInterval = null;

    function updatePassedTime(interval = true) {
        $('#passedTime').text(timeFormatBySeconds(getPassedTime()));
        if (interval) {
            updatePassedTimeInterval = setInterval(function () {
                $('#passedTime').text(timeFormatBySeconds(getPassedTime()));
            }, 1000)
        }
    }

    function postMessageToPlayer(data) {
        document.getElementById("iframe-embed").contentWindow.postMessage(JSON.stringify(data), '*');
    }

    initCountDownPlayer();

    function viewerConnect() {
        const viewerConnectInterval = setInterval(function () {
            if (checkedLogin) {
                socket.emit('viewerConnect', {
                    auth: {id_encrypt: loggedInfo.id_encrypt || null}
                });
                clearInterval(viewerConnectInterval);
            }
        }, 100);
    }

    // setTimeout(viewerConnect, 3000);

    $('.btn-start-live').click(function () {
        $('.btn-start-live').remove();
        $('.btn-endLive').show();
        socket.emit('startLive', {auth: {id_encrypt: loggedInfo.id_encrypt || null}});
    });

    function liveEnded() {
        $('#iframe-embed').attr('src', '');
        playerContainer.hide();
        playerMask.show();

        playerWrapper.addClass('ls___-player ls___-player-pending');
        $('.player-notice').show();
        $('.text-ended').show();
        $('.text-start-manual').hide();
        $('.pc-share').hide();
        $('.cb-button').hide();
        $('.player-countdown').hide();
        $('.live-stats .item-setting').hide();

        clearInterval(updatePassedTimeInterval);
    }

    var eventMethod = window.addEventListener
        ? "addEventListener"
        : "attachEvent";
    var eventer = window[eventMethod];
    var messageEvent = eventMethod === "attachEvent"
        ? "onmessage"
        : "message";
    eventer(messageEvent, function (e) {
        var data = e.data || e.message;
        try {
            data = JSON.parse(data);
            if (data.channel === "megacloud") {
                if (data.event === "complete") {
                    if (isHost) {
                        $('.ep-item.active').next() && $('.ep-item.active').next().click();
                    }
                    // liveEnded();
                }
                if (data.event === "time") {
                    // if (getPassedTime() > data.duration) {
                    //     liveEnded();
                    // }
                }
                if (data.event === "ready") {

                }
                if (data.event === "error") {

                }
            }
        } catch (e) {

        }
    });

    dayjs.extend(window.dayjs_plugin_relativeTime)

    const jsrender = window.jsrender;

    const messageTmpl = jsrender.templates("#messageTmpl"), actionTmpl = jsrender.templates("#actionTmpl");

    const psChat = new PerfectScrollbar('.t_c-chatlist');

    function scrollToLatestMessage() {
        document.querySelector(".t_c-chatlist").scrollTo(0, document.querySelector(".t_c-chatlist").scrollHeight);
    }

    var slowMode = 0, countTimer = 0, countTimerInterval = null, replyId = null, firstInit = true;

    if (Cookies.get('showChatBox')) {
        $("#top_chat").removeClass('chatbox-hide');
    }

    $("#toggle-chatbox").click(function () {
        $("#top_chat").toggleClass("chatbox-hide");
    });

    socket.on("disconnect", () => {
        console.log('-> Socket disconnected')
    });
    socket.on('sendNotice', function (data) {
        document.getElementById("chat-content").innerHTML += data.text;
        psChat.update();
        if (!$('#chat-scrollBottom').hasClass('show')) {
            scrollToLatestMessage();
        }
    })
    socket.on('receiveMessage', (serverData) => {
        if (serverData.wait) {
            countTimer = serverData.wait;
            startCountDown();
        } else if (serverData.error) {
            $('#chatError').text(serverData.error);
            $('.user-limit').show();
        } else {
            document.getElementById("chat-content").innerHTML += messageTmpl.render(serverData);
            psChat.update();
            if (!$('#chat-scrollBottom').hasClass('show')) {
                scrollToLatestMessage();
            }
        }
    })
    socket.on('clearMessage', () => {
        document.getElementById("chat-content").innerHTML = "";
        psChat.update();
    })
    socket.on('deleteMessage', (svData) => {
        document.querySelector(`.item[data-id="${svData.id}"]`).remove();
        psChat.update();
    })
    socket.on('changeEpisode', (svData) => {
        $('#episode-number').text(svData.episode.number);
        if (airTime > 0) {
            getEmbed();
        }
    })
    socket.on('endLive', (svData) => {
        liveEnded();
    })
    socket.on('initData', (svData) => {
        if (firstInit) {
            firstInit = false;
            slowMode = svData.slowMode;

            if (slowMode > 0) {
                const inputMessageEl = $('#message');
                const messagePlaceholder = inputMessageEl.attr('placeholder');
                inputMessageEl.attr('placeholder', messagePlaceholder + ' (Slow mode is on)');
            }

            var html = '';
            // svData.pinnedMessages.forEach(item => {
            //     html += pinnedMessageTmpl.render({chat: item, loggedInfo});
            // });
            $('.t_c-pin').html(html);

            svData.latestMessages.forEach(item => {
                document.getElementById("chat-content").innerHTML += messageTmpl.render(item);
            });
            scrollToLatestMessage();
            $('#loading-data').hide();
        }
    })

    function countMessageLength() {
        const message = document.getElementById('message').value;
        document.getElementById('messageLength').innerHTML = message.length;
    }

    document.getElementById('message').addEventListener('keydown', function (event) {
        if (event.keyCode === 13) {
            document.getElementById('sendMessage').click();
        }
        countMessageLength();
    })
    document.getElementById('message').addEventListener('keyup', function (event) {
        countMessageLength();
    })
    $(document).on('click', '.deleteMessage', function () {
        console.log($(this).data('id'))
        socketEmit("deleteMessage", {id: $(this).data('id')});
    })
    document.getElementById('chat-content').addEventListener('mouseover', function (event) {
        const timeEl = event.target.querySelector('.is-time');
        if (timeEl) {
            timeEl.innerHTML = dayjs(dayjs.unix(parseInt(timeEl.getAttribute("data-time")))).fromNow();
        }
    });

    function renderActions(messId, senderRoles, senderId) {
        document.getElementById(`actions-${messId}`).innerHTML = actionTmpl.render({
            id: messId,
            senderId,
            senderRoles,
            loggedInfo
        });
    }

    function socketEmit(event, data = {}) {
        data.auth = {id_encrypt: loggedInfo.id_encrypt};
        socket.emit(event, data);
    }

    function startChatCountDown() {
        countTimerInterval && clearInterval(countTimerInterval);

        document.getElementById('slowModeMessage').style.display = 'block';
        document.getElementById('countTimer').innerHTML = `${slowMode - countTimer}s`;

        countTimerInterval = setInterval(function () {
            if (countTimer < slowMode - 1) {
                countTimer += 1;
                document.getElementById('countTimer').innerHTML = `${slowMode - countTimer}s`;
            } else {
                countTimer = 0;
                document.getElementById('slowModeMessage').style.display = 'none';
                clearInterval(countTimerInterval);
            }
        }, 1000);
    }

    function sendMessage(message) {
        if (countTimer === 0) {
            if (message === '/clear') {
                socketEmit("clearMessage");
            } else {
                socketEmit("sendMessage", {message, replyId});
                replyId = null;
                $('#replyContent').hide();
                if (slowMode > 0 && loggedInfo.roles === 0) {
                    startChatCountDown();
                }
            }
            document.getElementById('message').value = "";
            document.getElementById('messageLength').innerHTML = 0;
        }
    }

    document.getElementById('sendMessage').addEventListener('click', function () {
        if (checkLogin()) {
            const message = document.getElementById('message').value;
            if (message.trim().length === 0) return;
            $('.user-limit').hide();
            sendMessage(message);
        }
    })
    document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
        const inputMessage = document.getElementById('message');
        inputMessage.value = inputMessage.value + event.detail.unicode;
        inputMessage.focus();
    });

    var gifPage = 1, giphyApiKey = "mCHTgpTZWxrnFxaLpVhD44FajzH6JmVs";

    function trendingGifs() {
        $.get(`https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=48&rating=g`, function (res) {
            if (res.data) {
                res.data.forEach(item => {
                    $('#tab-sticker .sticker-list').append(`<div class="sl-item"><div class="sli-img"><img src="${item.images.fixed_width_small.webp}"></div></div>`);
                })
            }
        })
    }

    trendingGifs();

    function searchGifs(keyword) {
        const limit = 30, offset = (gifPage - 1) * limit;
        $.get(`https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${keyword}&limit=${limit}&offset=${offset}&rating=r&lang=en`, function (res) {
            if (res.data) {
                res.data.forEach(item => {
                    $('#tab-sticker .sticker-list').append(`<div class="sl-item"><div class="sli-img"><img src="${item.images.fixed_width_small.webp}"></div></div>`);
                })
            }
        })
    }

    $(document).on('click', '#tab-sticker .sticker-list .sl-item', function () {
        sendMessage(`[zr-img]${$(this).find('img').attr('src')}[/zr-img]`);
        $('#dropdownEmo').dropdown('toggle');
    });

    $('#searchStickers').on('keyup', function () {
        const keyword = $(this).val();
        $('#tab-sticker .sticker-list').empty();
        if (keyword) {
            searchGifs(keyword);
        } else {
            trendingGifs();
        }
    })

    $('#tab-sticker .sticker-list').on('scroll', function () {
        if ($(this).scrollTop() + $(this).innerHeight() >= ($(this)[0].scrollHeight - 60)) {
            const keyword = $('#searchStickers').val();
            if (keyword.trim().length > 0) {
                gifPage += 1;
                searchGifs(keyword);
            }
        }
    })
    $('.t_c-chatlist').on('scroll', function () {
        if ($(this).scrollTop() + $(this).innerHeight() < ($(this)[0].scrollHeight - 60)) {
            $('#chat-scrollBottom').addClass('show');
            $('#chat-scrollBottom').show();
        } else {
            $('#chat-scrollBottom').removeClass('show');
            $('#chat-scrollBottom').hide();
        }
    })
    $('#chat-scrollBottom').click(function () {
        scrollToLatestMessage();
    })

    function replyMessage(id) {
        const messEl = $(`#chat-content .item[data-id="${id}"]`);
        console.log(messEl.find('.is-name').html())
        $('#replyContent').show();
        $('#replyContent .is-name').html(messEl.find('.is-name').html());
        $('#replyContent .text').html(messEl.find('.is-subject p').html());

        const inputMessage = document.getElementById('message');
        inputMessage.focus();
    }

    $(document).on('click', '.is-reply a, .replyMessage', function () {
        replyId = $(this).data('id');
        replyMessage(replyId);
    })
    $(document).on('dblclick', '#chat-content .item', function () {
        replyId = $(this).data('id');
        replyMessage(replyId);
    })
    $(document).on('click', '#replyContent .is-cancel', function () {
        replyId = null;
        $('#replyContent').hide();
    })

    $('.btn-copy').click(function () {
        try {
            navigator.clipboard.writeText($('#live-url').text());
            $(this).toggleClass("active").attr('data-original-title', 'Copied!').tooltip('show');
            /* Resolved - text copied to clipboard successfully */
        } catch (err) {
            console.error('Failed to copy: ', err);
            /* Rejected - text failed to copy to the clipboard */
        }
    })

    $(document).on('click', '.player-time', function () {
        if ($('#iframe-embed').attr('src') !== "") {
            const time = $(this).data('time');
            document.getElementById("iframe-embed").contentWindow.postMessage(JSON.stringify({
                event: "seek",
                time
            }), '*');
        }
    });
}