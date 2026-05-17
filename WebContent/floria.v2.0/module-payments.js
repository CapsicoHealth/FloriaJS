/* ===========================================================================
 * Copyright (C) 2024 CapsicoHealth Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Date extensions
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export var FloriaPayments = { };


FloriaPayments.PayPalSDK = {
  _loadedCurrency: null,
  _loading: null,
  load(clientId, currency="USD") {
    if (window.paypal && this._loadedCurrency === currency)
     return Promise.resolve(window.paypal);
    if (this._loading) 
     return this._loading;

    // Remove prior script if different currency
    const old = document.querySelector('script[data-paypal-sdk]');
    if (old)
     old.remove();
    delete window.paypal;

    this._loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?client-id="+encodeURIComponent(clientId)+"&intent=capture&currency=" + encodeURIComponent(currency);
      s.async = true;
      s.dataset.paypalSdk = "1";
      s.onload = () => {
        this._loadedCurrency = currency;
        resolve(window.paypal);
        this._loading = null;
      };
      s.onerror = () => {
        reject(new Error("PayPal SDK load failed"));
        this._loading = null;
      };
      document.head.appendChild(s);
    });
    return this._loading;
  },
  initButtons: async function (buttonId, clientId, planCode, period, currency='USD') {
    // Render PayPal buttons
    try {
        // Load (or reload) the SDK for the selected currency.
        // If you already have FloriaPayments.PayPalSDK.load(baseUrl, currency) keep using it.
        const paypal = await FloriaPayments.PayPalSDK.load(clientId, currency);

        paypal.Buttons({
          style: { layout: 'vertical', label: 'paypal' },

          createOrder: function() {
            return fetch('/web/svc/payments/order/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              credentials: 'include',
              body: new URLSearchParams({
                 paymentProvider: 'paypal'
                ,planCode: planCode
                ,cycle: period
                ,currency: currency
              })
            }).then(r => r.json()).then(function(j) {
                 console.log('Created order', j);
                 return j.data.orderId;
            });
          },

          onApprove: function(data) {
            return fetch('/web/svc/payments/order/capture', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              credentials: 'include',
              body: new URLSearchParams({
                 paymentProvider: 'paypal'
                ,orderId: data.orderID 
              })
            })
            .then(r => r.json())
            .then(resp => {
              if (resp?.data?.completed == true) {
                alert('Payment successful. Plan activated.');
                window.location.reload();
              } else {
                alert('Payment not completed: ' + resp?.data?.message);
              }
            })
            .catch(e => {
              console.error(e);
              alert('Capture failed.');
            });
          },

          onCancel: () => alert('Payment cancelled.'),
          onError:  err => {
            console.error(err);
            alert('PayPal error.');
          }
        }).render('#'+buttonId);
      } catch(e) {
        console.error(e);
        alert('Unable to load PayPal.');
      }
  }
};




// PERSONAL-USD-MONTHLY
//<div id="paypal-button-container-P-1JT30264KG444845MNDSEEEA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-1JT30264KG444845MNDSEEEA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-1JT30264KG444845MNDSEEEA'); // Renders the PayPal button
//</script>


// PERSONAL-USD-YEARLY
//<div id="paypal-button-container-P-4JV15276W6172181TNDSEQUA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-4JV15276W6172181TNDSEQUA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-4JV15276W6172181TNDSEQUA'); // Renders the PayPal button
//</script>


// PROFESSIONAL-USD-YEARLY
//<div id="paypal-button-container-P-0WR51242PK283933ENDSUSCA"></div>
//<script src="https://www.paypal.com/sdk/js?client-id=AX23VzjuNuKugwTvw0wgfmHWOsa2z_ou4dFl1umvpbfUk7IV-AAhrifqUSFEsO1tZ39ijdczBn0P9YS7&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
//<script>
//  paypal.Buttons({
//      style: {
//          shape: 'rect',
//          color: 'gold',
//          layout: 'vertical',
//          label: 'subscribe'
//      },
//      createSubscription: function(data, actions) {
//        return actions.subscription.create({
//          /* Creates the subscription */
//          plan_id: 'P-0WR51242PK283933ENDSUSCA'
//        });
//      },
//      onApprove: function(data, actions) {
//        alert(data.subscriptionID); // You can add optional success message for the subscriber here
//      }
//  }).render('#paypal-button-container-P-0WR51242PK283933ENDSUSCA'); // Renders the PayPal button
//</script>
