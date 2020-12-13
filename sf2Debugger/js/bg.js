(function () {

    const db = {};
    let Configuration = {};

    /**
     * Only update the counter on the page action
     * @param tabId
     */
    const updatePageAction = function (tabId) {
        const tokenQuantity = getTokenQuantity(tabId);
        chrome.pageAction.setTitle({
            tabId: tabId,
            title: tokenQuantity + " Token(s)"
        });
    };
    const sendPopupMessage = function (action, data) {
        chrome.extension.sendMessage({action: action, data: data});
    };
    const getTokenQuantity = function (tabId) {
        if (typeof db[tabId] != "undefined") {
            return db[tabId].tokens.length;
        }
        return 0;
    };
    const getTokens = function (tabId) {
        if (typeof db[tabId] != "undefined") {
            return db[tabId].tokens;
        }
        return [];
    };
    const clearToken = tabId => {
        initTabDb(tabId);
        db[tabId].tokens = [];
        updatePageAction(tabId);
        sendPopupMessage("TokenListUpdated", {});
    };

    /**
     * Display the app icon into tha address bar of the corresponding tab
     * @param tabId
     */
    const handleIconDisplay = function (tabId) {
        const quantity = getTokenQuantity(tabId);
        const status = (quantity > 0);
        if (status) {
            chrome.pageAction.show(tabId);
            chrome.pageAction.setPopup({
                tabId: tabId,
                popup: "tokenSelection.html"
            });
            updatePageAction(tabId);
        } else {
            chrome.pageAction.hide(tabId);
        }
    };


    // Listen for any changes to the URL of any tab.
    chrome.tabs.onUpdated.addListener(handleIconDisplay);


    chrome.extension.onRequest.addListener(
        function (request, sender, sendResponse) {
            if (!request.method) {
                return;
            }

            switch (request.method) {
                case 'getTokens' :
                    var tabId = request.data.tabId;
                    var tokens = getTokens(tabId);
                    sendPopupMessage('setTokens', _.clone(tokens));
                    break;
                case 'clearTabDb' :
                    var tabId = request.data.tabId;
                    clearToken(tabId);
                    updatePageAction(tabId);
                    break;
                case 'reloadConfiguration' :
                    loadConfiguration(function(){});
            }
        }
    );

    /**
     * database management
     * ----------------------------------------
     */
    const initTabDb = tabId => {
        if (typeof db[tabId] == "undefined") {
            db[tabId] = {
                tokens: [],
                configuration: {}
            };
        }
    };

    const addToken = (tabId, data) => {
        initTabDb(tabId);
        data.popup = false;
        const profilerTokenSerial = JSON.stringify(data);
        data.popup = true;
        const profilerTokenSerialPopup = JSON.stringify(data);
        data.popup = false;
        data.profilerTokenSerial = profilerTokenSerial;
        data.profilerTokenSerialPopup = profilerTokenSerialPopup;
        db[tabId].tokens.push(data);
        updatePageAction(tabId);
        sendPopupMessage("TokenListUpdated", {});
    };

    /**
     * Parse all headers and return the tokenId if present
     * @param headers
     * @returns {null}
     */
    const getTokenFromHeaders = headers => {
        let token = null;
        const headerName = window.extractConfiguration('headerName', Configuration);
        _.each(headers, function (item) {
            if (item.name == headerName) {
                token = item.value;
            }
        });
        return token;
    };

    const getStatusFromStatusLine = function (statusLine) {
        const exploded = statusLine.split(" ");
        const code = exploded[1];
        const codeLevel = parseInt(code[0] + '00'); //We set a codeLevel with only the Hundred for level.

        return {
            code: exploded[1],
            message: exploded[2],
            httpVersion: exploded[0],
            codeLevel: codeLevel
        }
    };

    /**
     * Load the entire configuration. Will be updated periodically and on configuration save
     * @param callBack
     */
    function loadConfiguration(callBack){
        if(!callBack){
            callBack = function(){};
        }
        window.getConfiguration(function(config){
           Configuration = config ;
           callBack.apply(this);
        });
    }


    const forgeInternalToken = function (frameData) {
        const data = frameData;
        const responseHeaders = data.responseHeaders;
        const token = getTokenFromHeaders(responseHeaders);

        if (token == null) {
            return null;
        }

        const statusLine = data.statusLine;
        const url = data.url;
        const type = data.type;
        const status = getStatusFromStatusLine(statusLine);

        return {
            type: type,
            url: url,
            status: status.code,
            statusMessage: status.message,
            httpVersion: status.httpVersion,
            statusLine: statusLine,
            date: new Date(),
            codeLevel: status.codeLevel,
            value: token
        };
    };

    //Capture main_frame onlu (xxhr request not captured here)
    function startup() {
        /**
         * Handle main frame
         * @param data
         */
        const main_frame = function (data) {
            const tabId = data.tabId;
            const autoClearTab = window.extractConfiguration('autoClearTab', Configuration);
            //We check if the tabHistory must be cleared or kept
            if (autoClearTab === 'true' && getTokens(tabId).length > 0) {
                clearToken(tabId);
            }

            const tokenData = forgeInternalToken(data);
            if (tokenData !== null) {
                addToken(tabId, tokenData);
                handleIconDisplay(tabId);
            }
        };

        /**
         * Handle sub frame. do not clear token list
         * @param data
         */
        const sub_frame = function (data) {
            const tabId = data.tabId;
            const tokenData = forgeInternalToken(data);
            if (tokenData !== null) {
                addToken(tabId, tokenData);
                handleIconDisplay(tabId);
            }
        };


        loadConfiguration(function(){
            const filters_main_frame = {
                urls: ["<all_urls>"],
                types: ["main_frame"]
            };
            chrome.webRequest.onHeadersReceived.addListener(main_frame, filters_main_frame, ['responseHeaders']);
            const filters_sub_frame = {
                urls: ["<all_urls>"],
                types: ["xmlhttprequest", "sub_frame"]
            };
            chrome.webRequest.onHeadersReceived.addListener(sub_frame, filters_sub_frame, ['responseHeaders']);
        });

    }
    startup();
})();
