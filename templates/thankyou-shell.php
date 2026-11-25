<?php if (!defined('ABSPATH')) exit; ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><?php wp_head(); ?></head>
<body <?php body_class('ctwpml-thankyou-shell'); ?>><?php wp_body_open(); echo do_shortcode('[checkout_ml_obrigado]'); wp_footer(); ?></body>
</html>
