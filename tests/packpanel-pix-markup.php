<?php
/** Render the production pending-Pix fragment with synthetic values. */
if(PHP_SAPI!=='cli')exit;
$source=file_get_contents(dirname(__DIR__).'/packing-panel-woo-dev/templates/painel.php');
if(!preg_match('~<div class="order-address ppwoo-pix-copy">.*?</div>\s*</div>~s',$source,$match))throw new RuntimeException('Missing pending Pix component');
function esc_html($s){return htmlspecialchars($s,ENT_QUOTES);}
function esc_attr($s){return htmlspecialchars($s,ENT_QUOTES);}
function __($s,...$a){return $s;}
function esc_html_e($s,...$a){echo esc_html($s);}
function esc_attr_e($s,...$a){echo esc_attr($s);}
$pix_identifier=in_array('--empty',$argv,true)?'':'000201010212BR.GOV.BCB.PIXabcABC6304FFFF';
eval('?>'.$match[0]);
