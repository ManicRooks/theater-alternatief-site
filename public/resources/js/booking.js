$(document).ready(function(){
	const targetElement = document.querySelector('#voorstellingen');

	const callback = (entries, observer) => {
	  entries.forEach(entry => {
	    if (entry.isIntersecting) {
	      loadBooking(function(data){
	      	setBookingdata(targetElement, data);
	      });	     	      
	      observer.unobserve(entry.target);
	    }
	  });
	};

	const observer = new IntersectionObserver(callback, {
	  root: null,
	  threshold: 0.5 
	});

	observer.observe(targetElement);
});

function loadBooking(callback) {
 	fetch('reservatie/data.json.php')
	  .then(response => {
	    if (!response.ok) {
	      throw new Error('Network response was not ok');
	    }
	    return response.json(); 
	  })
	  .then(data => {
	    callback(data);
	  })
	  .catch(error => {
	    console.error('There was a problem with the fetch operation:', error);
	  });
}

function setBookingdata(targetElement, data) {
	if(data.leadtext)
		targetElement.querySelector('.container-lead-text').innerHTML = data.leadtext;


	let shows = targetElement.querySelector('.container-shows')
	const template = document.querySelector("#showrow");

	Object.entries(data.performances).forEach(([show, status]) => {
		const clone = template.content.cloneNode(true);
	  	let span = clone.querySelector("span");
	  	let button = clone.querySelector("button");
	  	span.textContent = show;
	  	if(status == "STATUS_INACTIVE" || status == "STATUS_ONLINE_RESERVATION_CLOSED"){
	  		button.parentNode.removeChild(button);
	  	} else if (status == "STATUS_LIMITED"){
	  		button.classList.add('btn-res-limited');  			
  			button.textContent = "Laatste plaatsen";
  		} else if (status == "STATUS_SOLDOUT"){
	  		button.classList.add('btn-res-soldout');  			
  			button.textContent = "Uitverkocht";
  			button.disabled = true;
	  	} else {	  	
	  		button.textContent = "Reserveren";
	  	}

	  	shows.appendChild(clone);
	});  
	shows.removeChild(shows.querySelector('.spinner')); 	
	  
}