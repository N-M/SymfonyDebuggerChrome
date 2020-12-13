(function(){
    const translate = function (messageID, args) {
        return chrome.i18n.getMessage(messageID, args);
    };

    const localizePage = () => {
        //translate a page into the users language
        $("[i18n]:not(.i18n-replaced)").each(function () {
            $(this).html(translate($(this).attr("i18n")));
        });
        $("[i18n_value]:not(.i18n-replaced)").each(function () {
            $(this).val(translate($(this).attr("i18n_value")));
        });
        $("[i18n_title]:not(.i18n-replaced)").each(function () {
            $(this).attr("title", translate($(this).attr("i18n_title")));
        });
        $("[i18n_placeholder]:not(.i18n-replaced)").each(function () {
            $(this).attr("placeholder", translate($(this).attr("i18n_placeholder")));
        });
        $("[i18n_replacement_el]:not(.i18n-replaced)").each(function () {
            // Replace a dummy <a/> inside of localized text with a real element.
            // Give the real element the same text as the dummy link.
            const dummy_link = $("a", this);
            const text = dummy_link.text();
            const real_el = $("#" + $(this).attr("i18n_replacement_el"));
            real_el.text(text).val(text).replaceAll(dummy_link);
            // If localizePage is run again, don't let the [i18n] code above
            // clobber our work
            $(this).addClass("i18n-replaced");
        });
    };


    localizePage();
})();
