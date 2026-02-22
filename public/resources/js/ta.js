
//Highlight menu items on scroll
$(document).ready(function(){

    $('.navbar-nav .nav-item .nav-link').eq(0).addClass('active');
    var sectionOffsets = {};
    $('.navbar-nav .nav-item .nav-link').each(function( index ) {
        var sectionId = $( this ).attr('href');
        var section = $(sectionId);

        
        sectionOffsets[sectionId] = section.offset().top - 200;
    });
    

    const handleScroll = () => {          
         var docScroll = $(document).scrollTop();
         var docScroll1 = docScroll + 1;
                 
         var secResult = Object.entries(sectionOffsets).reverse().find(([section, offset]) => docScroll1 >= offset);         
         var section = secResult[0];
         var offset = secResult[1];             
         $('.navbar-nav .nav-item .nav-link').removeClass('active');
         $('.navbar-nav .nav-item .nav-link[href="'+section+'"]').addClass('active');
         if(window.location.hash != section) {            
            history.replaceState(null, null, section);
         }                 
     };         
         
    const debouncedScroll = debounce(handleScroll, 50);
    window.addEventListener('scroll', debouncedScroll);
});

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

//Toggle sticky menu background on scroll and load
function setNavbarBackground(){
     if($(document).scrollTop() != 0)
        $(".navbar").addClass("is-floating");
    else
        $(".navbar").removeClass("is-floating");
}

$(document).scroll(setNavbarBackground);
$(document).ready(setNavbarBackground);