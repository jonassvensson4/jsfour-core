$(() => {
    $('.collapsible').collapsible();
    
    let token = $('#token').text();
    let endpoint = $('#endpoint').text();

    $('#client').remove();

    $('li').click( function () {
        $(`#${$(this).parent().attr('type')}`).val($(this).attr('data'));
        M.updateTextFields();
    });

    $('#submit-action').click(() => {
        fetch(`http://${endpoint}/jsfour-core/${token}/gamemaster`, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({
                'user': $('#playerID').val(),
                'event': $('#action').val()
            })
        });
        M.toast({html: 'You ran the event'});
    });

    $('form').submit(() => { return false; });
});